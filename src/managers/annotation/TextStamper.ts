import { degrees, rgb, type Color, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import {
  computeTextAnchor,
  displayedRectWidthPt,
  hexToRgb01,
  TEXT_LINE_HEIGHT_EM,
} from '@/lib/annotationGeometry'
import { detectBaseDirection, sanitizeAnnotationText } from '@/lib/annotationText'
import { splitLineIntoVisualRuns } from '@/lib/bidiVisualRuns'
import type { Rotation, TextPlacement } from '@/domain/types'

/**
 * Draws one text annotation onto an exported page. The anchor is the first
 * line's baseline in the creation-time displayed frame. Each line is drawn as
 * bidi runs in visual order: left-aligned for LTR text, right-aligned within
 * the drawn box for RTL text — mirroring the editor's `dir="auto"` rendering.
 */
export function stampTextAnnotation(
  page: PDFPage,
  placement: TextPlacement,
  totalRotation: Rotation,
  font: PDFFont,
): void {
  // Text is sanitized at input; re-sanitizing here keeps export unable to throw.
  const text = sanitizeAnnotationText(placement.text)
  if (text.trim() === '') return

  const anchor = computeTextAnchor(
    placement.rect,
    placement.fontSizePt,
    totalRotation,
    page.getCropBox(),
  )
  const { r, g, b } = hexToRgb01(placement.colorHex)
  const baseDirection = detectBaseDirection(text)
  const context: LineDrawContext = {
    font,
    sizePt: placement.fontSizePt,
    color: rgb(r, g, b),
    rotateDegrees: anchor.rotateDegrees,
    boxWidthPt: displayedRectWidthPt(placement.rect, totalRotation, page.getCropBox()),
    alignment: placement.textAlign ?? (baseDirection === 'rtl' ? 'right' : 'left'),
    opacity: placement.opacity,
  }

  const radians = (anchor.rotateDegrees * Math.PI) / 180
  const lineHeightPt = placement.fontSizePt * TEXT_LINE_HEIGHT_EM
  const lineAdvance = { x: Math.sin(radians) * lineHeightPt, y: -Math.cos(radians) * lineHeightPt }
  text.split('\n').forEach((line, lineIndex) => {
    const runs = splitLineIntoVisualRuns(line, baseDirection)
    if (runs.length === 0) return
    const origin = {
      x: anchor.x + lineAdvance.x * lineIndex,
      y: anchor.y + lineAdvance.y * lineIndex,
    }
    drawTextLine(page, runs, origin, context)
  })
}

interface LineDrawContext {
  font: PDFFont
  sizePt: number
  color: Color
  rotateDegrees: number
  /** Alignment span for RTL lines: the drawn box's width in points. */
  boxWidthPt: number
  alignment: 'left' | 'center' | 'right'
  opacity?: number
}

/** Draw one line's runs sequentially along the (possibly rotated) baseline. */
function drawTextLine(
  page: PDFPage,
  runs: string[],
  origin: { x: number; y: number },
  context: LineDrawContext,
): void {
  const { font, sizePt, color, rotateDegrees, boxWidthPt, alignment, opacity } = context
  const runWidths = runs.map((run) => font.widthOfTextAtSize(run, sizePt))
  const lineWidth = runWidths.reduce((sum, width) => sum + width, 0)
  const radians = (rotateDegrees * Math.PI) / 180
  const advance = { x: Math.cos(radians), y: Math.sin(radians) }

  let offset =
    alignment === 'right'
      ? Math.max(0, boxWidthPt - lineWidth)
      : alignment === 'center'
        ? Math.max(0, (boxWidthPt - lineWidth) / 2)
        : 0
  runs.forEach((run, index) => {
    page.drawText(run, {
      x: origin.x + advance.x * offset,
      y: origin.y + advance.y * offset,
      font,
      size: sizePt,
      color,
      rotate: degrees(rotateDegrees),
      opacity,
    })
    offset += runWidths[index]
  })
}
