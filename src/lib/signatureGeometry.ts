import type { NormalizedRect, Rotation, StrokePoint } from '@/domain/types'

/** Rectangle of a page box in PDF user space (origin bottom-left, y up). */
export interface PageBox {
  x: number
  y: number
  width: number
  height: number
}

/** Placement for pdf-lib's `drawImage`, in PDF user space. */
export interface PdfImagePlacement {
  x: number
  y: number
  width: number
  height: number
  /** Counter-clockwise degrees for drawImage's `rotate` option. */
  rotateDegrees: Rotation
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Normalized point of a pointer event within an element's bounding rect, clamped to [0,1]. */
export function normalizedPointInBounds(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): StrokePoint {
  return {
    x: clamp01((clientX - bounds.left) / bounds.width),
    y: clamp01((clientY - bounds.top) / bounds.height),
  }
}

/** Rotate a normalized rect 90° clockwise within its unit frame. */
export function rotateRectCW90(rect: NormalizedRect): NormalizedRect {
  return { x: 1 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width }
}

/** Rotate a normalized rect clockwise by a multiple of 90°. */
export function rotateRect(rect: NormalizedRect, delta: Rotation): NormalizedRect {
  let rotated = rect
  for (let step = 0; step < delta / 90; step += 1) rotated = rotateRectCW90(rotated)
  return rotated
}

/** Map a rect expressed in fractions of `outer` into `outer`'s own frame. */
export function mapRectWithin(outer: NormalizedRect, inner: NormalizedRect): NormalizedRect {
  return {
    x: outer.x + inner.x * outer.width,
    y: outer.y + inner.y * outer.height,
    width: inner.width * outer.width,
    height: inner.height * outer.height,
  }
}

/** Whether both rect sides reach `fraction` of the smaller displayed page dimension. */
export function meetsMinimumSize(
  rect: NormalizedRect,
  pageSize: { width: number; height: number },
  fraction = 0.04,
): boolean {
  const minSidePx = Math.min(pageSize.width, pageSize.height) * fraction
  return rect.width * pageSize.width >= minSidePx && rect.height * pageSize.height >= minSidePx
}

/** CSS percent positioning for a normalized rect inside a relative parent. */
export function rectToCssPercent(rect: NormalizedRect): {
  left: string
  top: string
  width: string
  height: string
} {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

/** Largest box of `aspectRatio` (width / height) that fits inside `container`. */
export function fitBoxWithin(
  container: { width: number; height: number },
  aspectRatio: number,
): { width: number; height: number } {
  const width = Math.min(container.width, container.height * aspectRatio)
  return { width, height: width / aspectRatio }
}

/**
 * Convert a rect stored in the sign-time displayed frame into a PDF user-space
 * placement for pdf-lib's `drawImage`.
 *
 * `totalSignRotation` is the page's full clockwise display rotation when the
 * user signed (intrinsic `/Rotate` + user rotation at sign time). The anchor is
 * the rect's displayed bottom-left corner; drawing rotated CCW by the same
 * angle cancels the viewer's CW rotation, so the stamp appears upright in the
 * sign-time view and spins together with the content on later rotates.
 */
export function computePdfPlacement(
  rect: NormalizedRect,
  totalSignRotation: Rotation,
  pageBox: PageBox,
): PdfImagePlacement {
  const sideways = totalSignRotation === 90 || totalSignRotation === 270
  const displayedWidth = sideways ? pageBox.height : pageBox.width
  const displayedHeight = sideways ? pageBox.width : pageBox.height

  const stampWidth = rect.width * displayedWidth
  const stampHeight = rect.height * displayedHeight
  const cornerX = rect.x * displayedWidth
  const cornerY = rect.y * displayedHeight + stampHeight

  const anchor = displayedPointToUserSpace(cornerX, cornerY, totalSignRotation, pageBox)
  return {
    x: pageBox.x + anchor.x,
    y: pageBox.y + anchor.y,
    width: stampWidth,
    height: stampHeight,
    rotateDegrees: totalSignRotation,
  }
}

/** Map a displayed point (top-left origin, y down) back to unrotated user space (y up). */
export function displayedPointToUserSpace(
  dx: number,
  dy: number,
  rotation: Rotation,
  pageBox: PageBox,
): { x: number; y: number } {
  const { width, height } = pageBox
  switch (rotation) {
    case 0:
      return { x: dx, y: height - dy }
    case 90:
      return { x: dy, y: dx }
    case 180:
      return { x: width - dx, y: dy }
    case 270:
      return { x: width - dy, y: height - dx }
  }
}
