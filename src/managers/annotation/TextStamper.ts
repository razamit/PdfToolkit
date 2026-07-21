import { degrees, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import { computeTextAnchor, hexToRgb01, TEXT_LINE_HEIGHT_EM } from '@/lib/annotationGeometry'
import { sanitizeWinAnsiText } from '@/lib/winAnsiText'
import type { Rotation, TextPlacement } from '@/domain/types'

/**
 * Draws one text annotation onto an exported page. The anchor is the first
 * line's baseline in the creation-time displayed frame; `drawText` splits on
 * newlines itself and advances by `lineHeight` in the rotated text frame.
 */
export function stampTextAnnotation(
  page: PDFPage,
  placement: TextPlacement,
  totalRotation: Rotation,
  font: PDFFont,
): void {
  // Text is sanitized at input; re-sanitizing here keeps export unable to throw.
  const text = sanitizeWinAnsiText(placement.text)
  if (text.trim() === '') return

  const anchor = computeTextAnchor(
    placement.rect,
    placement.fontSizePt,
    totalRotation,
    page.getCropBox(),
  )
  const { r, g, b } = hexToRgb01(placement.colorHex)
  page.drawText(text, {
    x: anchor.x,
    y: anchor.y,
    font,
    size: placement.fontSizePt,
    lineHeight: placement.fontSizePt * TEXT_LINE_HEIGHT_EM,
    color: rgb(r, g, b),
    rotate: degrees(anchor.rotateDegrees),
  })
}
