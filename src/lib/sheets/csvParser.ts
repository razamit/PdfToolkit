import {
  MAX_COLUMNS_PER_TABLE,
  MAX_ROWS_PER_TABLE,
  inferDirection,
  textCell,
  trimEmptyEdges,
  type SheetCell,
  type SheetTable,
} from './sheetTable'

/**
 * RFC 4180 CSV reader with delimiter sniffing.
 *
 * Written by hand rather than pulled from a dependency because the whole job is
 * one state machine over quotes and separators, and the alternative libraries
 * all bring streaming, transforms and type coercion this import does not want —
 * every cell reaches the renderer as the text the file already contained.
 */

/** Separators worth sniffing: comma, semicolon (European locales), tab, pipe. */
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const

export function parseCsv(text: string, tableName: string): SheetTable {
  const source = stripByteOrderMark(text)
  const delimiter = sniffDelimiter(source)
  const allRows = splitRecords(source, delimiter)
  const capped = allRows.slice(0, MAX_ROWS_PER_TABLE)
  const rows = trimEmptyEdges(capped.map(toCells))
  return {
    name: tableName,
    rows,
    omittedRowCount: Math.max(0, allRows.length - capped.length),
    // CSV carries no direction metadata at all, so the text is the only signal.
    direction: inferDirection(rows),
  }
}

function toCells(values: string[]): SheetCell[] {
  return values.slice(0, MAX_COLUMNS_PER_TABLE).map(textCell)
}

function stripByteOrderMark(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Pick the delimiter that yields the most consistent column count over the
 * first few records. Counting raw occurrences instead would pick the comma for
 * a semicolon-separated European export whose cells contain decimal commas.
 */
function sniffDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024)
  let best: string = CANDIDATE_DELIMITERS[0]
  let bestScore = -1
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const score = scoreDelimiter(sample, delimiter)
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }
  return best
}

/** Score = columns per record, rewarded for being stable across records. */
function scoreDelimiter(sample: string, delimiter: string): number {
  const records = splitRecords(sample, delimiter).slice(0, 20).filter((row) => row.length > 0)
  if (records.length === 0) return -1
  const widths = records.map((row) => row.length)
  const modalWidth = mostCommon(widths)
  if (modalWidth < 2) return 0
  const consistent = widths.filter((width) => width === modalWidth).length
  return modalWidth * (consistent / widths.length)
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = 0
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = value
    }
  }
  return best
}

/**
 * The RFC 4180 state machine. Quoted fields may contain the delimiter, CR, LF
 * and doubled quotes; CRLF, LF and lone CR all terminate a record.
 */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quoted) {
      if (char !== '"') {
        field += char
      } else if (text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = false
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records
}
