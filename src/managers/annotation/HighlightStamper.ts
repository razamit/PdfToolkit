import { BlendMode, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib'
import { hexToRgb01 } from '@/lib/annotationGeometry'
import { computePdfPlacement } from '@/lib/signatureGeometry'
import type { HighlightPlacement, Rotation } from '@/domain/types'

/**
 * Draws one highlight annotation onto an exported page: a filled rectangle per
 * text line, blended with Multiply so the glyphs underneath stay legible —
 * the same effect a real highlighter has over print.
 */
export function stampHighlightAnnotation(
  page: PDFPage,
  placement: HighlightPlacement,
  totalRotation: Rotation,
): void {
  const cropBox = page.getCropBox()
  const { r, g, b } = hexToRgb01(placement.colorHex)
  for (const lineRect of placement.lineRects) {
    const pdfPlacement = computePdfPlacement(lineRect, totalRotation, cropBox)
    page.drawRectangle({
      x: pdfPlacement.x,
      y: pdfPlacement.y,
      width: pdfPlacement.width,
      height: pdfPlacement.height,
      rotate: degrees(pdfPlacement.rotateDegrees),
      color: rgb(r, g, b),
      blendMode: BlendMode.Multiply,
    })
  }
}
