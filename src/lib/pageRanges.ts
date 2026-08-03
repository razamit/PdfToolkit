export interface ParsedPageRanges {
  /** One group per comma-separated token, preserving the user's order. */
  groups: number[][]
  /** Flattened page indices with duplicates removed, preserving first occurrence. */
  combined: number[]
}

/** Parse human page ranges such as `1-4, 7, 10-end` into zero-based indices. */
export function parsePageRanges(input: string, pageCount: number): ParsedPageRanges {
  if (pageCount < 1) throw new Error('There are no pages to export.')
  const tokens = input
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) throw new Error('Enter at least one page or range.')

  const groups = tokens.map((token) => parseToken(token, pageCount))
  const seen = new Set<number>()
  const combined: number[] = []
  for (const index of groups.flat()) {
    if (seen.has(index)) continue
    seen.add(index)
    combined.push(index)
  }
  return { groups, combined }
}

export function oddPageIndices(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 0)
}

export function evenPageIndices(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 1)
}

function parseToken(token: string, pageCount: number): number[] {
  const single = parseEndpoint(token, pageCount)
  if (single !== null) return [single]

  const match = token.match(/^(\d+|end)\s*-\s*(\d+|end)$/)
  if (!match) throw new Error(`“${token}” is not a valid page or range.`)
  const start = requireEndpoint(match[1], pageCount)
  const end = requireEndpoint(match[2], pageCount)
  const step = start <= end ? 1 : -1
  const result: number[] = []
  for (let index = start; ; index += step) {
    result.push(index)
    if (index === end) break
  }
  return result
}

function parseEndpoint(value: string, pageCount: number): number | null {
  if (value === 'end') return pageCount - 1
  if (!/^\d+$/.test(value)) return null
  const pageNumber = Number(value)
  if (pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Page ${pageNumber} is outside this ${pageCount}-page document.`)
  }
  return pageNumber - 1
}

function requireEndpoint(value: string, pageCount: number): number {
  const parsed = parseEndpoint(value, pageCount)
  if (parsed === null) throw new Error(`“${value}” is not a valid page number.`)
  return parsed
}
