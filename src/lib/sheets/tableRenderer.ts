import { rgb, type PDFDocument, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import { detectBaseDirection } from '@/lib/annotationText'
import { splitLineIntoVisualRuns } from '@/lib/bidiVisualRuns'
import { MAX_ROWS_PER_TABLE, type SheetDirection } from './sheetTable'
import type { LaidOutCell, LaidOutPage, LaidOutRow, TableLayoutOptions } from './tableLayout'

/**
 * Draws laid-out table pages into a pdf-lib document as real text.
 *
 * Styling follows the app's own palette (zinc rules, a filled header band, no
 * vertical rules) rather than imitating a spreadsheet's gridlines — this page
 * is a readable document, not a screenshot of Excel.
 */

export const SHEET_FONT_SIZE = 9

export const SHEET_LAYOUT: TableLayoutOptions = {
  // A4 portrait; `renderTablePages` swaps the axes for landscape tables.
  pageWidth: 595.28,
  pageHeight: 841.89,
  margin: 36,
  lineHeight: 11.5,
  cellPaddingX: 5,
  cellPaddingY: 4,
  captionHeight: 20,
}

const TEXT_COLOR = rgb(0.094, 0.094, 0.106)
const CAPTION_COLOR = rgb(0.443, 0.443, 0.478)
const HEADER_FILL = rgb(0.957, 0.957, 0.965)
const ROW_RULE = rgb(0.894, 0.894, 0.906)
const HEADER_RULE = rgb(0.831, 0.831, 0.847)

export interface RenderTableOptions {
  layout: TableLayoutOptions
  font: PDFFont
  /** The worksheet name, shown on the sheet's leading margin on every page. */
  caption: string
  /** Appended to the caption when the reader dropped rows past the cap. */
  omittedRowCount: number
  /**
   * Sheet direction. The cells arrive already mirrored (see `reverseColumns`),
   * so this governs only where the table block and its caption sit on the page:
   * an RTL sheet hangs off the right margin, not the left.
   */
  direction: SheetDirection
}

export function renderTablePages(
  document: PDFDocument,
  pages: LaidOutPage[],
  options: RenderTableOptions,
): void {
  for (const laidOut of pages) {
    const page = document.addPage([options.layout.pageWidth, options.layout.pageHeight])
    drawTablePage(page, laidOut, options)
  }
}

function drawTablePage(page: PDFPage, laidOut: LaidOutPage, options: RenderTableOptions): void {
  const { layout } = options
  const tableWidth = laidOut.columnWidths.reduce((sum, width) => sum + width, 0)
  // A table narrower than the page still starts at the sheet's leading margin,
  // so an RTL sheet reads from the right edge rather than floating on the left.
  const originX =
    options.direction === 'rtl'
      ? layout.pageWidth - layout.margin - tableWidth
      : layout.margin
  let top = layout.pageHeight - layout.margin

  if (laidOut.header) {
    drawHeaderBand(page, laidOut.header, top, originX, tableWidth)
    drawRow(page, laidOut.header, laidOut.columnWidths, { top, originX }, options)
    top -= laidOut.header.height
    drawRule(page, originX, top, tableWidth, HEADER_RULE, 0.75)
  }

  for (const row of laidOut.rows) {
    drawRow(page, row, laidOut.columnWidths, { top, originX }, options)
    top -= row.height
    drawRule(page, originX, top, tableWidth, ROW_RULE, 0.5)
  }

  drawCaption(page, laidOut, options)
}

function drawHeaderBand(
  page: PDFPage,
  header: LaidOutRow,
  top: number,
  originX: number,
  tableWidth: number,
): void {
  page.drawRectangle({
    x: originX,
    y: top - header.height,
    width: tableWidth,
    height: header.height,
    color: HEADER_FILL,
  })
}

function drawRule(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  color: ReturnType<typeof rgb>,
  thickness: number,
): void {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness, color })
}

interface RowOrigin {
  top: number
  originX: number
}

function drawRow(
  page: PDFPage,
  row: LaidOutRow,
  columnWidths: number[],
  origin: RowOrigin,
  options: RenderTableOptions,
): void {
  let x = origin.originX
  row.cells.forEach((cell, index) => {
    const width = columnWidths[index] ?? 0
    drawCell(page, cell, { x, width, top: origin.top }, options)
    x += width
  })
}

interface CellBox {
  x: number
  width: number
  top: number
}

function drawCell(
  page: PDFPage,
  cell: LaidOutCell,
  box: CellBox,
  options: RenderTableOptions,
): void {
  const { layout, font } = options
  const inner = Math.max(1, box.width - layout.cellPaddingX * 2)
  // A Hebrew cell reads right-aligned regardless of what its content looks
  // like numerically, matching how the same text renders in the editor.
  const align = detectBaseDirection(cell.lines.join(' ')) === 'rtl' ? 'right' : cell.align

  cell.lines.forEach((line, lineIndex) => {
    if (line === '') return
    const baseline =
      box.top -
      layout.cellPaddingY -
      SHEET_FONT_SIZE +
      SHEET_FONT_SIZE * 0.2 -
      lineIndex * layout.lineHeight
    drawTextLine(page, line, {
      left: box.x + layout.cellPaddingX,
      innerWidth: inner,
      baseline,
      align,
      font,
    })
  })
}

interface TextLineBox {
  left: number
  innerWidth: number
  baseline: number
  align: 'left' | 'right'
  font: PDFFont
}

/**
 * Draw one line as bidi runs in visual order — the same treatment text
 * annotations get, so a Hebrew cell comes out in the order the editor shows.
 */
function drawTextLine(page: PDFPage, line: string, box: TextLineBox): void {
  const runs = splitLineIntoVisualRuns(line, detectBaseDirection(line))
  if (runs.length === 0) return
  const widths = runs.map((run) => box.font.widthOfTextAtSize(run, SHEET_FONT_SIZE))
  const total = widths.reduce((sum, width) => sum + width, 0)

  let x = box.align === 'right' ? box.left + Math.max(0, box.innerWidth - total) : box.left
  runs.forEach((run, index) => {
    page.drawText(run, {
      x,
      y: box.baseline,
      font: box.font,
      size: SHEET_FONT_SIZE,
      color: TEXT_COLOR,
    })
    x += widths[index]
  })
}

const CAPTION_FONT_SIZE = 7.5

function drawCaption(page: PDFPage, laidOut: LaidOutPage, options: RenderTableOptions): void {
  const parts = [options.caption]
  if (laidOut.columnGroupCount > 1) {
    parts.push(`columns ${laidOut.columnGroupIndex} of ${laidOut.columnGroupCount}`)
  }
  if (options.omittedRowCount > 0) {
    parts.push(`first ${MAX_ROWS_PER_TABLE.toLocaleString('en-US')} rows shown`)
  }
  const { layout, font, direction } = options
  const text = parts.join(' · ')
  const runs = splitLineIntoVisualRuns(text, direction === 'rtl' ? 'rtl' : detectBaseDirection(text))
  const widths = runs.map((run) => font.widthOfTextAtSize(run, CAPTION_FONT_SIZE))
  const total = widths.reduce((sum, width) => sum + width, 0)

  // The caption sits on the sheet's leading margin, matching the table above it.
  let x = direction === 'rtl' ? layout.pageWidth - layout.margin - total : layout.margin
  runs.forEach((run, index) => {
    page.drawText(run, {
      x,
      y: layout.margin * 0.55,
      font,
      size: CAPTION_FONT_SIZE,
      color: CAPTION_COLOR,
    })
    x += widths[index]
  })
}
