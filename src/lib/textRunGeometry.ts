import { clamp01 } from './signatureGeometry'
import type { NormalizedRect } from '@/domain/types'

/**
 * Pure geometry for text-aware highlighting: mapping pdf.js text items into
 * normalized page rects, and merging selected runs into per-line highlight
 * bars. Kept free of pdf.js imports (structural types only) so it is testable
 * in isolation; `TextContentManager` feeds it real items and viewports.
 */

/** A horizontal run of text in the base displayed frame ([0,1], origin top-left, y down). */
export interface TextRun {
  str: string
  rect: NormalizedRect
}

/** Structural subset of pdf.js's `TextItem`. */
export interface TextItemLike {
  str: string
  /** Text-space → user-space matrix [a, b, c, d, e, f]; (e, f) is the baseline start. */
  transform: number[]
  /** Advance width in user-space units. */
  width: number
  /** Approximate ascent height in user-space units. */
  height: number
}

/** Structural subset of pdf.js's `PageViewport` (scale 1, intrinsic rotation, y down). */
export interface ViewportLike {
  width: number
  height: number
  convertToViewportPoint(x: number, y: number): number[]
}

/** Measures the relative advance width of a string (any consistent unit). */
export type TextMeasurer = (text: string) => number

/** |shear| / |scale| above which an item counts as rotated in-page and is skipped. */
const AXIS_ALIGN_TOLERANCE = 0.05

/**
 * Map pdf.js text items to normalized runs, skipping empty and in-page-rotated
 * items. Items are split into whitespace-separated words — PDFs often encode a
 * whole line as one item, and word runs are what make selection feel like
 * selecting text rather than rows. `measure` apportions each word's position
 * within its item proportionally to measured text widths.
 */
export function mapTextItemsToRuns(
  items: TextItemLike[],
  viewport: ViewportLike,
  measure: TextMeasurer,
): TextRun[] {
  const runs: TextRun[] = []
  for (const item of items) {
    if (item.str.trim() === '' || !isAxisAligned(item.transform)) continue
    for (const word of splitIntoWordSpans(item.str, measure)) {
      const rect = spanRectInViewport(item, word.startFraction, word.endFraction, viewport)
      if (rect) runs.push({ str: word.text, rect })
    }
  }
  return runs
}

interface WordSpan {
  text: string
  /** Horizontal start/end within the item, as fractions of its advance width. */
  startFraction: number
  endFraction: number
}

/**
 * Split an item's text into words with measured fractional offsets. The
 * measurer approximates the embedded font's proportions; small deviations only
 * shift a word's bar edges by a glyph or so. pdf.js emits `str` in visual
 * order, so fractions map to geometry for RTL text too.
 */
function splitIntoWordSpans(str: string, measure: TextMeasurer): WordSpan[] {
  const total = measure(str)
  if (total <= 0) return [{ text: str, startFraction: 0, endFraction: 1 }]
  const words: WordSpan[] = []
  for (const match of str.matchAll(/\S+/g)) {
    words.push({
      text: match[0],
      startFraction: measure(str.slice(0, match.index)) / total,
      endFraction: Math.min(measure(str.slice(0, match.index + match[0].length)) / total, 1),
    })
  }
  return words
}

function isAxisAligned(transform: number[]): boolean {
  const [scaleX, shearY, shearX, scaleY] = transform
  const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY))
  if (scale === 0) return false
  return (
    Math.abs(shearY) <= scale * AXIS_ALIGN_TOLERANCE &&
    Math.abs(shearX) <= scale * AXIS_ALIGN_TOLERANCE
  )
}

/** Axis-aligned bbox of a horizontal span of an item, normalized to the viewport. */
function spanRectInViewport(
  item: TextItemLike,
  startFraction: number,
  endFraction: number,
  viewport: ViewportLike,
): NormalizedRect | null {
  const [, , , , originX, originY] = item.transform
  const spanStart = originX + item.width * startFraction
  const spanEnd = originX + item.width * endFraction
  const corners = [
    viewport.convertToViewportPoint(spanStart, originY),
    viewport.convertToViewportPoint(spanEnd, originY),
    viewport.convertToViewportPoint(spanStart, originY + item.height),
    viewport.convertToViewportPoint(spanEnd, originY + item.height),
  ]
  const xs = corners.map(([x]) => x / viewport.width)
  const ys = corners.map(([, y]) => y / viewport.height)
  const left = clamp01(Math.min(...xs))
  const top = clamp01(Math.min(...ys))
  const width = clamp01(Math.max(...xs)) - left
  const height = clamp01(Math.max(...ys)) - top
  if (width <= 0 || height <= 0) return null
  return { x: left, y: top, width, height }
}

/** Vertical-center distance (in fractions of run height) within which runs share a line. */
const LINE_GROUP_TOLERANCE = 0.6
/** Extra height added to each merged line for the classic marker look. */
const LINE_PADDING_FRACTION = 0.15

/** Merge selected run rects into one padded rect per text line, top to bottom. */
export function mergeRunsIntoLines(rects: NormalizedRect[]): NormalizedRect[] {
  const sorted = [...rects].sort((a, b) => centerY(a) - centerY(b))
  const groups: NormalizedRect[][] = []
  for (const rect of sorted) {
    const group = groups[groups.length - 1]
    if (group && sharesLine(group[group.length - 1], rect)) group.push(rect)
    else groups.push([rect])
  }
  return groups.map(mergeGroup)
}

function centerY(rect: NormalizedRect): number {
  return rect.y + rect.height / 2
}

function sharesLine(a: NormalizedRect, b: NormalizedRect): boolean {
  const tolerance = LINE_GROUP_TOLERANCE * Math.max(a.height, b.height)
  return Math.abs(centerY(a) - centerY(b)) <= tolerance
}

function mergeGroup(group: NormalizedRect[]): NormalizedRect {
  const left = Math.min(...group.map((rect) => rect.x))
  const right = Math.max(...group.map((rect) => rect.x + rect.width))
  const top = Math.min(...group.map((rect) => rect.y))
  const bottom = Math.max(...group.map((rect) => rect.y + rect.height))
  const padding = (bottom - top) * (LINE_PADDING_FRACTION / 2)
  const paddedTop = clamp01(top - padding)
  return {
    x: left,
    y: paddedTop,
    width: right - left,
    height: clamp01(bottom + padding) - paddedTop,
  }
}
