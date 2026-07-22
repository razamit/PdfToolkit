import type { NormalizedRect, Rotation } from '@/domain/types'
import { displayedPointToUserSpace, type PageBox } from './signatureGeometry'

/** Line height applied to annotation text, in ems (mirrored by the preview CSS). */
export const TEXT_LINE_HEIGHT_EM = 1.2

/** Helvetica vertical metrics in ems (from the AFM: ascender 718, descender 207). */
const HELVETICA_ASCENT_EM = 0.718
const HELVETICA_DESCENT_EM = 0.207

/**
 * Distance from the top of a CSS line box to the first text baseline, in ems.
 * CSS splits the leading evenly above and below the ascent + descent span, so
 * anchoring pdf-lib's baseline here makes export match the overlay preview.
 */
export const TEXT_FIRST_BASELINE_EM =
  (TEXT_LINE_HEIGHT_EM - (HELVETICA_ASCENT_EM + HELVETICA_DESCENT_EM)) / 2 + HELVETICA_ASCENT_EM

export interface RgbColor01 {
  r: number
  g: number
  b: number
}

/** Parse a #rrggbb hex color into 0..1 channels (the input pdf-lib's `rgb()` expects). */
export function hexToRgb01(hex: string): RgbColor01 {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  }
}

export interface PdfTextAnchor {
  x: number
  y: number
  rotateDegrees: Rotation
}

/**
 * PDF user-space anchor of a text annotation's first baseline, for pdf-lib's
 * `drawText` (which starts at the baseline and rotates about it). The rect is
 * in the creation-time displayed frame; `totalRotation` composes the page's
 * intrinsic `/Rotate` with the user rotation at creation, exactly like
 * `computePdfPlacement` does for image-style stamps.
 */
export function computeTextAnchor(
  rect: NormalizedRect,
  fontSizePt: number,
  totalRotation: Rotation,
  pageBox: PageBox,
): PdfTextAnchor {
  const sideways = totalRotation === 90 || totalRotation === 270
  const displayedWidth = sideways ? pageBox.height : pageBox.width
  const displayedHeight = sideways ? pageBox.width : pageBox.height

  const baselineX = rect.x * displayedWidth
  const baselineY = rect.y * displayedHeight + fontSizePt * TEXT_FIRST_BASELINE_EM
  const anchor = displayedPointToUserSpace(baselineX, baselineY, totalRotation, pageBox)
  return { x: pageBox.x + anchor.x, y: pageBox.y + anchor.y, rotateDegrees: totalRotation }
}

/** Width of a placement rect in points, measured in its creation-time displayed frame. */
export function displayedRectWidthPt(
  rect: NormalizedRect,
  totalRotation: Rotation,
  pageBox: PageBox,
): number {
  const sideways = totalRotation === 90 || totalRotation === 270
  return rect.width * (sideways ? pageBox.height : pageBox.width)
}

/**
 * Displayed page size in PDF points, inferred by matching the rendered
 * bitmap's aspect against the descriptor's intrinsic size. The descriptor
 * doesn't carry the intrinsic `/Rotate`, but the bitmap honors it, so the
 * orientation whose aspect matches the bitmap is the displayed one.
 */
export function displayedPageSizePt(
  intrinsic: { width: number; height: number },
  renderedAspect: number,
): { widthPt: number; heightPt: number } {
  const asIs = intrinsic.width / intrinsic.height
  const swapped = intrinsic.height / intrinsic.width
  const useSwapped = Math.abs(swapped - renderedAspect) < Math.abs(asIs - renderedAspect)
  return useSwapped
    ? { widthPt: intrinsic.height, heightPt: intrinsic.width }
    : { widthPt: intrinsic.width, heightPt: intrinsic.height }
}
