import { detectBaseDirection } from '@/lib/annotationText'

/**
 * The one shape every spreadsheet reader produces and the table renderer
 * consumes. Deliberately dumb: already-formatted display strings plus an
 * alignment hint, with no cell styling, formulas or merge information.
 *
 * That flatness is the feature, not a shortcut — this import path draws real
 * vector text rather than reproducing the source's own layout, so anything a
 * renderer could not honour is dropped at the reader instead of travelling
 * through the pipeline as data nobody uses.
 */

/** Numbers and dates read right-aligned; everything else reads left-aligned. */
export type CellAlign = 'left' | 'right'

/**
 * Reading direction of a worksheet as a whole. In an RTL sheet column A is the
 * *rightmost* column and the table hangs off the right margin — this is a
 * property of the sheet, distinct from the direction of any one cell's text,
 * which `CellAlign` covers and which Excel resolves from content regardless of
 * the sheet's own direction.
 */
export type SheetDirection = 'ltr' | 'rtl'

export interface SheetCell {
  text: string
  align: CellAlign
}

export interface SheetTable {
  /** Worksheet name, or the file's base name for a single-table CSV. */
  name: string
  /** Row-major cells. The first row is rendered as the repeating header. */
  rows: SheetCell[][]
  /** Rows dropped by `MAX_ROWS_PER_TABLE`, disclosed on the rendered page. */
  omittedRowCount: number
  direction: SheetDirection
}

/**
 * Row ceiling per worksheet. A 100k-row sheet would spend minutes laying out
 * and produce a PDF nobody opens, so the import renders the first slice and
 * says so on the page rather than hanging or truncating silently.
 */
export const MAX_ROWS_PER_TABLE = 10_000

/** Column ceiling per worksheet, applied for the same reason as the row cap. */
export const MAX_COLUMNS_PER_TABLE = 256

/** Values that look numeric, so a column of figures lines up on its decimal side. */
const NUMERIC_PATTERN = /^[-+(]?[$€£₪¥]?\s?\d[\d\s,]*(\.\d+)?\s?[%)]?$/

export function alignForText(text: string): CellAlign {
  return NUMERIC_PATTERN.test(text.trim()) ? 'right' : 'left'
}

export function textCell(text: string): SheetCell {
  return { text, align: alignForText(text) }
}

/**
 * Trim trailing empty rows and columns. Spreadsheets routinely report a used
 * range far larger than the data in it, and without this a 12-row sheet can
 * render as 900 blank rows across 20 pages.
 */
export function trimEmptyEdges(rows: SheetCell[][]): SheetCell[][] {
  let lastRow = -1
  let lastColumn = -1
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell.text.trim() === '') return
      lastRow = rowIndex
      if (columnIndex > lastColumn) lastColumn = columnIndex
    })
  })
  if (lastRow < 0) return []
  return rows
    .slice(0, lastRow + 1)
    .map((row) => padRow(row.slice(0, lastColumn + 1), lastColumn + 1))
}

/** Ragged rows are squared off so every row has the same column count. */
function padRow(row: SheetCell[], width: number): SheetCell[] {
  const padded = row.slice()
  while (padded.length < width) padded.push({ text: '', align: 'left' })
  return padded
}

/**
 * Infer direction from the text itself, for the two cases where the file does
 * not say: CSV, which carries no metadata at all, and .xlsx written by tools
 * that never emit `sheetView/@rightToLeft` (its default is false, so an LTR
 * sheet normally omits it and an absent flag is genuinely "unstated").
 *
 * Only cells with a *strong* direction vote, and a strict majority is required,
 * so an English table with one Hebrew label stays left-to-right.
 */
export function inferDirection(rows: SheetCell[][]): SheetDirection {
  let rightToLeft = 0
  let leftToRight = 0
  for (const row of rows) {
    for (const cell of row) {
      const text = cell.text.trim()
      if (text === '' || !STRONG_DIRECTION_PATTERN.test(text)) continue
      if (detectBaseDirection(text) === 'rtl') rightToLeft += 1
      else leftToRight += 1
    }
  }
  return rightToLeft > leftToRight ? 'rtl' : 'ltr'
}

/** Has at least one strongly-directional letter, so `detectBaseDirection` is meaningful. */
const STRONG_DIRECTION_PATTERN = /[֐-׿A-Za-zªºÀ-ÖØ-öø-ÿŒ-žƒ]/

/**
 * Mirror the column order for an RTL sheet, so column A ends up rightmost.
 *
 * Doing it here — once, before anything is measured — is what keeps the rest of
 * the pipeline direction-agnostic: natural widths, header alignment, wrapping
 * and the column grouping that continues a wide sheet across pages all operate
 * on the mirrored order without knowing it was mirrored, and a wide RTL sheet
 * therefore starts its first group at the right-hand columns, as it should.
 */
export function reverseColumns(rows: SheetCell[][]): SheetCell[][] {
  return rows.map((row) => row.slice().reverse())
}
