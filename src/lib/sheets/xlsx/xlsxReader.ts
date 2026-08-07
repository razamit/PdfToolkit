import { SourceLoadError } from '@/domain/errors'
import {
  MAX_COLUMNS_PER_TABLE,
  MAX_ROWS_PER_TABLE,
  alignForText,
  inferDirection,
  trimEmptyEdges,
  type SheetCell,
  type SheetDirection,
  type SheetTable,
} from '../sheetTable'
import { formatCellNumber, type CellFormat } from './numberFormat'
import {
  readCellFormats,
  readSharedStrings,
  readStringItem,
  readWorkbookInfo,
} from './workbookParts'
import { readXmlEntry, unzipEntries, type ZipEntries } from './zipEntries'

/**
 * Reads the visible values of an .xlsx workbook into plain tables.
 *
 * Scope is deliberately "what the sheet shows": cached cell values (not
 * formulas), the number format applied to them, and nothing else. Charts,
 * images, conditional formatting, merged-cell spans, colours and column widths
 * are not read, because the renderer draws its own table and could not honour
 * them — see `docs/DECISIONS.md`.
 */

/**
 * Extends `SourceLoadError` so a spreadsheet that cannot be read surfaces
 * through the coordinator's existing per-file failure path with its own
 * message, rather than being flattened into the generic "could not be loaded".
 */
export class SpreadsheetReadError extends SourceLoadError {
  constructor(message: string) {
    super(message)
    this.name = 'SpreadsheetReadError'
  }
}

export async function readXlsx(bytes: Uint8Array, fileName: string): Promise<SheetTable[]> {
  const entries = await unzipOrThrow(bytes, fileName)
  const workbook = readWorkbookInfo(entries)
  if (!workbook || workbook.sheets.length === 0) {
    throw new SpreadsheetReadError(`"${fileName}" has no readable worksheets.`)
  }

  const context: ReadContext = {
    entries,
    sharedStrings: readSharedStrings(entries),
    formats: readCellFormats(entries),
    use1904Epoch: workbook.use1904Epoch,
  }

  const tables = workbook.sheets
    .map((sheet) => readWorksheet(context, sheet.path, sheet.name))
    .filter((table) => table.rows.length > 0)

  if (tables.length === 0) {
    throw new SpreadsheetReadError(`"${fileName}" has no data in its worksheets.`)
  }
  return tables
}

async function unzipOrThrow(bytes: Uint8Array, fileName: string): Promise<ZipEntries> {
  try {
    return await unzipEntries(bytes)
  } catch {
    throw new SpreadsheetReadError(
      `"${fileName}" could not be opened — it may be corrupted, password-protected, or an older .xls file.`,
    )
  }
}

interface ReadContext {
  entries: ZipEntries
  sharedStrings: string[]
  formats: CellFormat[]
  use1904Epoch: boolean
}

/**
 * `sheetView/@rightToLeft` is the sheet's own declaration of its direction: when
 * set, column A is the *rightmost* column. Its schema default is false, so an
 * ordinary left-to-right sheet simply omits it — which means an absent flag is
 * "unstated" rather than "left to right", and only then is the text itself used
 * to decide. An explicit value, either way, is always obeyed.
 */
function readDeclaredDirection(document: Document | null): SheetDirection | null {
  const view = document?.getElementsByTagName('sheetView')[0]
  const value = view?.getAttribute('rightToLeft')
  if (value === null || value === undefined) return null
  return value === '1' || value === 'true' ? 'rtl' : 'ltr'
}

function readWorksheet(context: ReadContext, path: string, name: string): SheetTable {
  const document = readXmlEntry(context.entries, path)
  const declaredDirection = readDeclaredDirection(document)
  const rowNodes = document ? Array.from(document.getElementsByTagName('row')) : []
  const capped = rowNodes.slice(0, MAX_ROWS_PER_TABLE)

  const grid: SheetCell[][] = []
  for (const rowNode of capped) {
    // `r` is the sheet's own 1-based row number; honouring it keeps blank rows
    // blank instead of closing the gaps and shifting data upward.
    const index = Number(rowNode.getAttribute('r'))
    const target = Number.isFinite(index) && index > 0 ? index - 1 : grid.length
    if (target >= MAX_ROWS_PER_TABLE) continue
    while (grid.length <= target) grid.push([])
    grid[target] = readRow(context, rowNode)
  }

  const rows = trimEmptyEdges(squareOff(grid))
  return {
    name,
    rows,
    omittedRowCount: Math.max(0, rowNodes.length - capped.length),
    direction: declaredDirection ?? inferDirection(rows),
  }
}

function squareOff(grid: SheetCell[][]): SheetCell[][] {
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0)
  return grid.map((row) => {
    const padded = row.slice(0, width)
    while (padded.length < width) padded.push(emptyCell())
    return padded
  })
}

function readRow(context: ReadContext, rowNode: Element): SheetCell[] {
  const cells: SheetCell[] = []
  for (const cellNode of rowNode.getElementsByTagName('c')) {
    const columnIndex = columnIndexOf(cellNode.getAttribute('r'), cells.length)
    if (columnIndex >= MAX_COLUMNS_PER_TABLE) continue
    while (cells.length <= columnIndex) cells.push(emptyCell())
    cells[columnIndex] = readCell(context, cellNode)
  }
  return cells
}

function emptyCell(): SheetCell {
  return { text: '', align: 'left' }
}

/** `AB12` → 27. Falls back to document order when the ref is missing. */
export function columnIndexOf(reference: string | null, fallback: number): number {
  if (!reference) return fallback
  let index = 0
  for (const char of reference) {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index > 0 ? index - 1 : fallback
}

function readCell(context: ReadContext, cellNode: Element): SheetCell {
  const type = cellNode.getAttribute('t') ?? 'n'

  if (type === 'inlineStr') {
    const inline = cellNode.getElementsByTagName('is')[0]
    return textOnlyCell(inline ? readStringItem(inline) : '')
  }

  const raw = firstChildText(cellNode, 'v')
  if (raw === null) return emptyCell()

  switch (type) {
    case 's': {
      const index = Number(raw)
      return textOnlyCell(context.sharedStrings[index] ?? '')
    }
    case 'str':
      return textOnlyCell(raw)
    case 'b':
      return { text: raw === '1' ? 'TRUE' : 'FALSE', align: 'left' }
    case 'e':
      return { text: raw, align: 'left' }
    case 'd':
      // ISO 8601 in the file already; show the date part, drop the T separator.
      return { text: raw.replace('T', ' ').replace(/\.\d+Z?$/, ''), align: 'right' }
    default:
      return readNumericCell(context, cellNode, raw)
  }
}

function readNumericCell(context: ReadContext, cellNode: Element, raw: string): SheetCell {
  const value = Number(raw)
  if (!Number.isFinite(value)) return textOnlyCell(raw)
  const styleIndex = Number(cellNode.getAttribute('s') ?? NaN)
  const format = Number.isFinite(styleIndex) ? context.formats[styleIndex] : undefined
  return { text: formatCellNumber(value, format, context.use1904Epoch), align: 'right' }
}

/**
 * Text cells keep the sheet's own alignment intent only as far as detecting
 * digits: a shared string of "1,204" is a label the author typed, so it lines
 * up with the numbers beside it, while "N/A" stays left.
 */
function textOnlyCell(text: string): SheetCell {
  return { text, align: alignForText(text) }
}

/** Direct-child text of the first matching tag, ignoring nested namespaces. */
function firstChildText(parent: Element, tagName: string): string | null {
  for (const child of parent.children) {
    if (child.tagName === tagName || child.localName === tagName) return child.textContent ?? ''
  }
  return null
}
