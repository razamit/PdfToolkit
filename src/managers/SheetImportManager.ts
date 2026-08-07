import { PDFDocument, type PDFFont } from '@cantoo/pdf-lib'
import { fetchAnnotationFontBytes } from '@/lib/annotationFont'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { parseCsv } from '@/lib/sheets/csvParser'
import {
  alignForText,
  reverseColumns,
  type SheetCell,
  type SheetTable,
} from '@/lib/sheets/sheetTable'
import {
  layoutTable,
  measureNaturalColumnWidths,
  type TableLayoutOptions,
  type TextMeasurer,
} from '@/lib/sheets/tableLayout'
import { SHEET_FONT_SIZE, SHEET_LAYOUT, renderTablePages } from '@/lib/sheets/tableRenderer'
import { SpreadsheetReadError, readXlsx } from '@/lib/sheets/xlsx/xlsxReader'

/**
 * Converts spreadsheets to PDF **on the device**, then hands the bytes back so
 * the ordinary PDF ingest path takes over. Nothing here talks to the network.
 *
 * The output is drawn text, not a picture of a spreadsheet: it stays
 * selectable, searchable and a few kilobytes, and every later feature (crop,
 * annotate, split, export) works on it exactly as on an uploaded PDF. What it
 * cannot do is reproduce the source's own appearance — cell colours, fonts,
 * merged spans, charts and images are not carried over. See `docs/DECISIONS.md`.
 */

export type SpreadsheetFormat = 'csv' | 'xlsx'

const CSV_EXTENSIONS = ['.csv', '.tsv']
/** `.xlsm` is macro-enabled but structurally identical; macros are never run. */
const XLSX_EXTENSIONS = ['.xlsx', '.xlsm']

const A4_LONG_EDGE = 841.89
const A4_SHORT_EDGE = 595.28

/** Cap on the width-measurement cache, so a huge sheet cannot grow it without bound. */
const MEASURE_CACHE_LIMIT = 50_000

/**
 * Spreadsheet formats a user will reasonably expect to work, described so the
 * failure names the actual problem and the fix. Without this an .xls lands on
 * the generic "isn't a PDF, image, or spreadsheet" message, which reads as if
 * spreadsheets are unsupported altogether.
 */
const UNREADABLE_FORMATS: Record<string, string> = {
  '.xls': 'the older binary Excel format',
  '.xlsb': "Excel's binary workbook format",
  '.ods': 'the OpenDocument spreadsheet format',
  '.numbers': "Apple's Numbers format",
}

/** A sentence explaining why this file is rejected, or `null` if it isn't one of these. */
export function unsupportedSpreadsheetReason(file: File): string | null {
  const name = file.name.toLowerCase()
  for (const [extension, description] of Object.entries(UNREADABLE_FORMATS)) {
    if (name.endsWith(extension)) {
      return `"${file.name}" is ${description}, which can't be read in the browser. Re-save it as .xlsx or .csv and try again.`
    }
  }
  return null
}

export function spreadsheetFormatOf(file: File): SpreadsheetFormat | null {
  const name = file.name.toLowerCase()
  if (CSV_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'csv'
  if (XLSX_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'xlsx'
  // Extension wins over MIME because `application/vnd.ms-excel` is reported for
  // both .csv and the unsupported binary .xls, so it cannot decide on its own.
  if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') return 'csv'
  if (file.type.endsWith('spreadsheetml.sheet')) return 'xlsx'
  return null
}

export class SheetImportManager {
  /** Read `file` and return the bytes of a PDF rendering of its tables. */
  async convertToPdfBytes(file: File, format: SpreadsheetFormat): Promise<Uint8Array> {
    const tables = await this.readTables(file, format)
    const document = await PDFDocument.create()
    document.setTitle(file.name)
    const font = await embedSheetFont(document)
    const measure = createMeasurer(font)

    for (const table of tables) {
      renderOneTable(document, sanitizeTable(table), font, measure)
    }

    if (document.getPageCount() === 0) {
      throw new SpreadsheetReadError(`"${file.name}" has no data to convert.`)
    }
    return document.save()
  }

  private async readTables(file: File, format: SpreadsheetFormat): Promise<SheetTable[]> {
    if (format === 'csv') {
      const table = parseCsv(await file.text(), baseName(file.name))
      if (table.rows.length === 0) {
        throw new SpreadsheetReadError(`"${file.name}" is empty.`)
      }
      return [table]
    }
    return readXlsx(new Uint8Array(await file.arrayBuffer()), file.name)
  }
}

function renderOneTable(
  document: PDFDocument,
  table: SheetTable,
  font: PDFFont,
  measure: TextMeasurer,
): void {
  if (table.rows.length === 0) return
  // Mirrored once, up front, so measurement, wrapping and column grouping stay
  // direction-agnostic and a wide RTL sheet groups from its rightmost columns.
  const rows = table.direction === 'rtl' ? reverseColumns(table.rows) : table.rows
  const naturals = measureNaturalColumnWidths(rows, measure, SHEET_LAYOUT.cellPaddingX)
  const layout = layoutForWidth(sum(naturals))
  const pages = layoutTable(rows, naturals, measure, layout)
  renderTablePages(document, pages, {
    layout,
    font,
    caption: table.name,
    omittedRowCount: table.omittedRowCount,
    direction: table.direction,
  })
}

/**
 * Portrait when the table's natural width fits it, landscape otherwise — the
 * choice a person makes before printing a spreadsheet, and the reason a wide
 * sheet does not arrive as a column of squeezed, wrapped text.
 */
function layoutForWidth(naturalWidth: number): TableLayoutOptions {
  const fitsPortrait = naturalWidth <= A4_SHORT_EDGE - SHEET_LAYOUT.margin * 2
  return fitsPortrait
    ? { ...SHEET_LAYOUT, pageWidth: A4_SHORT_EDGE, pageHeight: A4_LONG_EDGE }
    : { ...SHEET_LAYOUT, pageWidth: A4_LONG_EDGE, pageHeight: A4_SHORT_EDGE }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Drop characters the embedded font has no glyph for, using the same filter as
 * text annotations, so `drawText` can never throw mid-conversion. Tabs become
 * spaces because a tab has no width in a PDF text run.
 */
function sanitizeTable(table: SheetTable): SheetTable {
  return { ...table, rows: table.rows.map((row) => row.map(sanitizeCell)) }
}

function sanitizeCell(cell: SheetCell): SheetCell {
  const text = sanitizeAnnotationText(cell.text.replace(/\t/g, ' ').replace(/\r/g, ''))
  return text === cell.text ? cell : { text, align: text === '' ? cell.align : alignForText(text) }
}

async function embedSheetFont(document: PDFDocument): Promise<PDFFont> {
  // Liberation Sans covers Latin and Hebrew and is the font the editor previews
  // with, so a sheet exports in the same glyphs as everything else in the app.
  const [{ default: fontkit }, fontBytes] = await Promise.all([
    import('@pdf-lib/fontkit'),
    fetchAnnotationFontBytes(),
  ])
  document.registerFontkit(fontkit)
  return document.embedFont(fontBytes, { subset: true })
}

/**
 * Width measurement is the hot path of layout — every cell is measured for its
 * column, then again while wrapping — and spreadsheet columns repeat values
 * heavily, so a plain memo removes most of the work.
 */
function createMeasurer(font: PDFFont): TextMeasurer {
  const cache = new Map<string, number>()
  return (text: string) => {
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const width = font.widthOfTextAtSize(text, SHEET_FONT_SIZE)
    if (cache.size < MEASURE_CACHE_LIMIT) cache.set(text, width)
    return width
  }
}

function baseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  return withoutExtension === '' ? fileName : withoutExtension
}
