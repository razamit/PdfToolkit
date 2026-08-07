import type { SheetCell } from './sheetTable'

/**
 * Turns a table of cells into positioned, wrapped, paginated text — with no
 * knowledge of pdf-lib. Width measurement is injected, so the layout is a pure
 * function of the text and the page box and can be reasoned about (and, later,
 * tested) without embedding a font or building a document.
 */

/** Width of a string at the body font size, in PDF points. */
export type TextMeasurer = (text: string) => number

export interface TableLayoutOptions {
  pageWidth: number
  pageHeight: number
  margin: number
  lineHeight: number
  cellPaddingX: number
  cellPaddingY: number
  /** Vertical room reserved under the table for the sheet caption. */
  captionHeight: number
}

/**
 * Narrowest a column may be squeezed before the table is split across pages
 * instead. Roughly six characters at 9pt — below that every cell wraps to one
 * word per line and the table stops being readable.
 */
const MIN_COLUMN_WIDTH = 42

/** Widest a single column may claim, so one long note cannot starve the rest. */
const MAX_NATURAL_COLUMN_WIDTH = 220

/** Hard ceiling on wrapped lines in one cell, keeping any row within a page. */
const MAX_LINES_PER_CELL = 12

export interface LaidOutCell {
  lines: string[]
  align: SheetCell['align']
  /** True when the cell's text was clipped by `MAX_LINES_PER_CELL`. */
  clipped: boolean
}

export interface LaidOutRow {
  cells: LaidOutCell[]
  height: number
}

export interface LaidOutPage {
  columnWidths: number[]
  /** Repeated on every page of the table; `null` when the table has one row. */
  header: LaidOutRow | null
  rows: LaidOutRow[]
  /** 1-based position of this page within its column group, and the group size. */
  columnGroupIndex: number
  columnGroupCount: number
}

/**
 * `naturals` comes from `measureNaturalColumnWidths` rather than being computed
 * here, because the caller needs it first to choose the page orientation — and
 * measuring every cell twice on a ten-thousand-row sheet is the one cost in
 * this path large enough to notice.
 */
export function layoutTable(
  rows: SheetCell[][],
  naturals: number[],
  measure: TextMeasurer,
  options: TableLayoutOptions,
): LaidOutPage[] {
  if (rows.length === 0) return []
  const available = options.pageWidth - options.margin * 2
  const groups = groupColumns(naturals.length, available)
  const aligned = alignHeaderToColumns(rows)

  return groups.flatMap((group, groupIndex) =>
    paginateGroup(aligned, group, naturals, measure, options, {
      columnGroupIndex: groupIndex + 1,
      columnGroupCount: groups.length,
    }),
  )
}

/**
 * A heading is a label, so `alignForText` always calls it left — which leaves
 * "Revenue" hanging over the left edge of a column of right-aligned figures.
 * Headings instead adopt whatever their own column's data does.
 */
function alignHeaderToColumns(rows: SheetCell[][]): SheetCell[][] {
  if (rows.length < 2) return rows
  const header = rows[0].map((cell, index) => {
    const align = dominantColumnAlign(rows, index)
    return align === cell.align ? cell : { ...cell, align }
  })
  return [header, ...rows.slice(1)]
}

function dominantColumnAlign(rows: SheetCell[][], index: number): SheetCell['align'] {
  let right = 0
  let left = 0
  for (let row = 1; row < rows.length; row += 1) {
    const cell = rows[row][index]
    if (!cell || cell.text.trim() === '') continue
    if (cell.align === 'right') right += 1
    else left += 1
  }
  return right > left ? 'right' : 'left'
}

/** Width each column would take if nothing forced it narrower. */
export function measureNaturalColumnWidths(
  rows: SheetCell[][],
  measure: TextMeasurer,
  paddingX: number,
): number[] {
  const widths = new Array<number>(rows[0]?.length ?? 0).fill(MIN_COLUMN_WIDTH)
  for (const row of rows) {
    row.forEach((cell, index) => {
      if (index >= widths.length) return
      const longest = widestSegment(cell.text, measure)
      widths[index] = Math.max(widths[index], Math.min(longest + paddingX * 2, MAX_NATURAL_COLUMN_WIDTH))
    })
  }
  return widths
}

/** A cell's own newlines already break it, so only the longest segment matters. */
function widestSegment(text: string, measure: TextMeasurer): number {
  let widest = 0
  for (const segment of text.split('\n')) widest = Math.max(widest, measure(segment))
  return widest
}

/**
 * Split columns into groups that each fit the page width. Excel's own print
 * behaviour: a sheet too wide for the paper continues on later pages rather
 * than shrinking until it cannot be read.
 */
function groupColumns(columnCount: number, available: number): number[][] {
  const perGroup = Math.max(1, Math.floor(available / MIN_COLUMN_WIDTH))
  if (columnCount <= perGroup) return [range(columnCount)]
  const groups: number[][] = []
  for (let start = 0; start < columnCount; start += perGroup) {
    groups.push(range(Math.min(perGroup, columnCount - start), start))
  }
  return groups
}

function range(length: number, offset = 0): number[] {
  return Array.from({ length }, (_, index) => index + offset)
}

interface GroupPosition {
  columnGroupIndex: number
  columnGroupCount: number
}

function paginateGroup(
  rows: SheetCell[][],
  group: number[],
  naturals: number[],
  measure: TextMeasurer,
  options: TableLayoutOptions,
  position: GroupPosition,
): LaidOutPage[] {
  const available = options.pageWidth - options.margin * 2
  const columnWidths = distributeWidths(
    group.map((index) => naturals[index]),
    available,
  )
  const laidOut = rows.map((row) =>
    layoutRow(group.map((index) => row[index] ?? emptyCell()), columnWidths, measure, options),
  )

  const header = laidOut.length > 1 ? laidOut[0] : null
  const body = header ? laidOut.slice(1) : laidOut
  const contentHeight = options.pageHeight - options.margin * 2 - options.captionHeight
  return splitRowsIntoPages(body, header, contentHeight).map((pageRows) => ({
    columnWidths,
    header,
    rows: pageRows,
    ...position,
  }))
}

function emptyCell(): SheetCell {
  return { text: '', align: 'left' }
}

/**
 * A table that already fits keeps its natural widths and simply ends where its
 * content ends — stretching it to the margins would dump every spare point into
 * one column, which is what a printed spreadsheet never does and what made a
 * six-column sheet render with one enormous first column and a page of gap.
 *
 * Only when the columns are over-subscribed does water-filling apply: columns
 * narrower than an equal share keep their natural width and donate the rest, so
 * a table of short codes and one long description spends the squeeze on the
 * description instead of shrinking every column equally.
 */
function distributeWidths(naturals: number[], available: number): number[] {
  const total = naturals.reduce((sum, width) => sum + width, 0)
  if (total <= available) return naturals.slice()

  const widths = new Array<number>(naturals.length).fill(0)
  const pending = naturals.map((width, index) => ({ width, index })).sort((a, b) => a.width - b.width)

  let remaining = available
  let unassigned = pending.length
  for (const { width, index } of pending) {
    const share = remaining / unassigned
    const assigned = Math.min(width, share)
    widths[index] = assigned
    remaining -= assigned
    unassigned -= 1
  }
  return widths
}

function layoutRow(
  cells: SheetCell[],
  columnWidths: number[],
  measure: TextMeasurer,
  options: TableLayoutOptions,
): LaidOutRow {
  const laidOut = cells.map((cell, index) => {
    const inner = Math.max(1, columnWidths[index] - options.cellPaddingX * 2)
    const wrapped = wrapText(cell.text, inner, measure)
    return {
      lines: wrapped.lines,
      align: cell.align,
      clipped: wrapped.clipped,
    }
  })
  const lineCount = laidOut.reduce((max, cell) => Math.max(max, cell.lines.length), 1)
  return { cells: laidOut, height: lineCount * options.lineHeight + options.cellPaddingY * 2 }
}

interface WrappedText {
  lines: string[]
  clipped: boolean
}

export function wrapText(text: string, width: number, measure: TextMeasurer): WrappedText {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (lines.length >= MAX_LINES_PER_CELL) break
    lines.push(...wrapParagraph(paragraph, width, measure))
  }
  if (lines.length <= MAX_LINES_PER_CELL) return { lines: lines.length > 0 ? lines : [''], clipped: false }
  return { lines: [...lines.slice(0, MAX_LINES_PER_CELL - 1), `${lines[MAX_LINES_PER_CELL - 1]}…`], clipped: true }
}

function wrapParagraph(paragraph: string, width: number, measure: TextMeasurer): string[] {
  if (paragraph === '' || measure(paragraph) <= width) return [paragraph]
  const lines: string[] = []
  let current = ''
  for (const word of paragraph.split(/(\s+)/)) {
    if (word === '') continue
    const candidate = current + word
    if (current !== '' && measure(candidate) > width) {
      lines.push(current.trimEnd())
      current = word.trimStart()
    } else {
      current = candidate
    }
    // A single "word" longer than the column (a URL, an unbroken id) must be
    // chopped by character or it would overflow the cell silently.
    while (measure(current) > width && current.length > 1) {
      const head = longestPrefixWithin(current, width, measure)
      lines.push(head)
      current = current.slice(head.length)
    }
  }
  if (current !== '') lines.push(current.trimEnd())
  return lines
}

function longestPrefixWithin(text: string, width: number, measure: TextMeasurer): string {
  let low = 1
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (measure(text.slice(0, middle)) <= width) low = middle
    else high = middle - 1
  }
  return text.slice(0, Math.max(1, low))
}

function splitRowsIntoPages(
  rows: LaidOutRow[],
  header: LaidOutRow | null,
  contentHeight: number,
): LaidOutRow[][] {
  const headerHeight = header?.height ?? 0
  const pages: LaidOutRow[][] = []
  let current: LaidOutRow[] = []
  let used = headerHeight

  for (const row of rows) {
    if (current.length > 0 && used + row.height > contentHeight) {
      pages.push(current)
      current = []
      used = headerHeight
    }
    current.push(row)
    used += row.height
  }
  if (current.length > 0 || pages.length === 0) pages.push(current)
  return pages
}
