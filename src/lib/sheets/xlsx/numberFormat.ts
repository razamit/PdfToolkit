/**
 * The bounded slice of ECMA-376 number formatting this import honours.
 *
 * A spreadsheet stores `43831`, not `1 Jan 2020`; without reading the format
 * code every date column would render as five-digit serials, which is the
 * single most visible way a sheet-to-PDF conversion looks broken. So format
 * codes are read — but only far enough to answer four questions: is this a
 * date, a time, a percentage, or a number with fixed decimals?
 *
 * Deliberately NOT implemented: locale tokens, `[$-409]` sections, colour and
 * condition sections, text sections, fractions, and scientific notation. Those
 * render through the general number path instead of half-working. Dates use one
 * unambiguous ISO-style shape rather than following the file's own token order,
 * because a wrong `mm/dd` vs `dd/mm` guess silently changes what the data says.
 */

/** Built-in format ids reserved for dates, times and datetimes by the spec. */
const BUILT_IN_DATE_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57, 58, 59])
const BUILT_IN_TIME_IDS = new Set([18, 19, 20, 21, 45, 46, 47])

/**
 * Numeric built-ins carry no `formatCode` in `styles.xml` — the id alone means
 * the format. Without this table a column styled "#,##0.00" (id 4, the second
 * most common format in any real workbook after General) would lose both its
 * grouping and its decimals and render as a bare float.
 */
const BUILT_IN_NUMBER_CODES: Record<number, string> = {
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  9: '0%',
  10: '0.00%',
  37: '#,##0;-#,##0',
  38: '#,##0;-#,##0',
  39: '#,##0.00;-#,##0.00',
  40: '#,##0.00;-#,##0.00',
}

/** Resolve the effective format code, filling in built-ins that declare none. */
export function effectiveFormatCode(format: CellFormat | undefined): string {
  if (!format) return ''
  if (format.code !== '') return format.code
  return BUILT_IN_NUMBER_CODES[format.numberFormatId] ?? ''
}

export interface CellFormat {
  /** Format code from `styles.xml`, or `''` for a built-in with no code. */
  code: string
  numberFormatId: number
}

export type FormatShape = 'date' | 'time' | 'datetime' | 'percent' | 'number'

export function classifyFormat(format: CellFormat | undefined): FormatShape {
  if (!format) return 'number'
  const { numberFormatId } = format
  if (BUILT_IN_DATE_IDS.has(numberFormatId)) return numberFormatId === 22 ? 'datetime' : 'date'
  if (BUILT_IN_TIME_IDS.has(numberFormatId)) return 'time'
  const code = effectiveFormatCode(format)
  if (code === '') return 'number'

  const tokens = stripLiteralSections(code)
  const hasDate = /[dy]/.test(tokens) || /m{3,}/.test(tokens)
  const hasTime = /[hs]/.test(tokens)
  if (hasDate && hasTime) return 'datetime'
  if (hasDate) return 'date'
  if (hasTime) return 'time'
  if (tokens.includes('%')) return 'percent'
  return 'number'
}

/**
 * Remove quoted literals, escaped characters, colour/condition brackets and
 * currency markers, so `"May"` or `[$$-409]` cannot be mistaken for date and
 * second tokens. `[h]`/`[m]`/`[s]` elapsed-time markers are kept as tokens.
 */
function stripLiteralSections(code: string): string {
  return code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(?![hms]\])[^\]]*\]/gi, '')
    .toLowerCase()
}

export function formatCellNumber(
  value: number,
  format: CellFormat | undefined,
  use1904Epoch: boolean,
): string {
  const shape = classifyFormat(format)
  if (shape === 'percent') return formatPercent(value, effectiveFormatCode(format))
  if (shape === 'number') return formatPlainNumber(value, effectiveFormatCode(format))
  return formatSerialDate(value, shape, format?.numberFormatId === 47, use1904Epoch)
}

/**
 * Honour a fixed decimal count (`0.00`) and thousands grouping (`#,##0`) when
 * the format asks for them; otherwise render the shortest exact-looking form.
 */
function formatPlainNumber(value: number, code: string): string {
  const { decimals, grouped } = readNumericTokens(code)
  const fixed = decimals === null ? trimNumber(value) : value.toFixed(Math.min(decimals, 20))
  return grouped ? addThousandsSeparators(fixed) : fixed
}

/** `0.0%` means one decimal *after* scaling, so the tokens are read the same way. */
function formatPercent(value: number, code: string): string {
  const { decimals } = readNumericTokens(code)
  const scaled = value * 100
  return `${decimals === null ? trimNumber(scaled) : scaled.toFixed(Math.min(decimals, 20))}%`
}

interface NumericTokens {
  decimals: number | null
  grouped: boolean
}

function readNumericTokens(code: string): NumericTokens {
  // Only the positive section governs how a value is written; the negative and
  // zero sections after `;` describe other cases and would double-count digits.
  const tokens = stripLiteralSections(code).split(';')[0]
  const decimals = tokens.includes('.') ? (tokens.split('.')[1].match(/0/g) ?? []).length : null
  // A comma is grouping only between digit placeholders — a trailing comma is
  // a thousands *scale* marker, which this import does not apply.
  return { decimals, grouped: /[#0],[#0]/.test(tokens) }
}

function addThousandsSeparators(text: string): string {
  const [whole, fraction] = text.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = sign ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${fraction}`
}

/** Round away binary-float noise (0.1+0.2) without inventing precision. */
function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(12)))
}

/** Milliseconds per day, the unit of a spreadsheet date serial. */
const MS_PER_DAY = 86_400_000

/**
 * Serial → calendar date under the 1900 epoch.
 *
 * Excel counts a 29 February 1900 that never existed, for Lotus 1-2-3
 * compatibility, so serials at or above 61 sit one day later than a naive
 * epoch would place them. Both branches are needed; using either alone puts
 * every date in one half of the range off by a day.
 */
export function serialToDate(serial: number, use1904Epoch: boolean): Date {
  if (use1904Epoch) return new Date(Date.UTC(1904, 0, 1) + serial * MS_PER_DAY)
  const epoch = serial < 61 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30)
  return new Date(epoch + serial * MS_PER_DAY)
}

function formatSerialDate(
  serial: number,
  shape: FormatShape,
  elapsed: boolean,
  use1904Epoch: boolean,
): string {
  if (shape === 'time' && elapsed) return formatElapsed(serial)
  const date = serialToDate(serial, use1904Epoch)
  if (Number.isNaN(date.getTime())) return trimNumber(serial)
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  if (shape === 'date') return day
  if (shape === 'time') return time
  return `${day} ${time}`
}

/** `[h]:mm:ss` durations count past 24 hours instead of wrapping to a clock. */
function formatElapsed(serial: number): string {
  const totalSeconds = Math.round(serial * 86_400)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}:${pad(minutes)}:${pad(totalSeconds % 60)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
