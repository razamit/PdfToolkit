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

/** |shear| / |scale| above which an item counts as rotated in-page and is skipped. */
const AXIS_ALIGN_TOLERANCE = 0.05

/** Map pdf.js text items to normalized runs, skipping empty and in-page-rotated items. */
export function mapTextItemsToRuns(items: TextItemLike[], viewport: ViewportLike): TextRun[] {
  const runs: TextRun[] = []
  for (const item of items) {
    if (item.str.trim() === '' || !isAxisAligned(item.transform)) continue
    const rect = itemRectInViewport(item, viewport)
    if (rect) runs.push({ str: item.str, rect })
  }
  return runs
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

/** Axis-aligned bbox of an item's baseline box, normalized to the viewport. */
function itemRectInViewport(item: TextItemLike, viewport: ViewportLike): NormalizedRect | null {
  const [, , , , originX, originY] = item.transform
  const corners = [
    viewport.convertToViewportPoint(originX, originY),
    viewport.convertToViewportPoint(originX + item.width, originY),
    viewport.convertToViewportPoint(originX, originY + item.height),
    viewport.convertToViewportPoint(originX + item.width, originY + item.height),
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
