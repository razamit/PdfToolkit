import { BlendMode, degrees, type PDFImage, type PDFPage } from '@cantoo/pdf-lib'
import { computePdfPlacement } from '@/lib/signatureGeometry'
import type { NormalizedRect, Rotation } from '@/domain/types'

/**
 * Draws one free-hand highlight onto an exported page. The strokes are
 * pre-rasterized (by `AnnotationStamper`) to a flat-colour transparent PNG
 * cropped to its bounding box; that PNG is drawn with a Multiply blend so the
 * whole shape blends over the page exactly once — the same single multiply as
 * the on-screen `mix-blend-multiply` layer, which is what keeps preview and
 * export in parity and stops self-overlaps from darkening.
 *
 * `bboxRect` is the ink bbox normalized to the creation-time displayed frame,
 * and the placement math is identical to image/signature stamps: the draw is
 * rotated back by `totalRotation` so it tracks the content on later rotates.
 */
export function stampFreehandHighlightAnnotation(
  page: PDFPage,
  bboxRect: NormalizedRect,
  totalRotation: Rotation,
  image: PDFImage,
): void {
  const pdfPlacement = computePdfPlacement(bboxRect, totalRotation, page.getCropBox())
  page.drawImage(image, {
    x: pdfPlacement.x,
    y: pdfPlacement.y,
    width: pdfPlacement.width,
    height: pdfPlacement.height,
    rotate: degrees(pdfPlacement.rotateDegrees),
    blendMode: BlendMode.Multiply,
  })
}
