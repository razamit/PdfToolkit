import { degrees, type PDFImage, type PDFPage } from '@cantoo/pdf-lib'
import { computePdfPlacement } from '@/lib/signatureGeometry'
import type { ImagePlacement, Rotation } from '@/domain/types'

/**
 * Draws one image annotation onto an exported page — the same placement math
 * as signature stamps: the rect lives in the creation-time displayed frame and
 * the draw is rotated back so it tracks the content on later rotates.
 */
export function stampImageAnnotation(
  page: PDFPage,
  placement: ImagePlacement,
  totalRotation: Rotation,
  image: PDFImage,
): void {
  const pdfPlacement = computePdfPlacement(placement.rect, totalRotation, page.getCropBox())
  page.drawImage(image, {
    x: pdfPlacement.x,
    y: pdfPlacement.y,
    width: pdfPlacement.width,
    height: pdfPlacement.height,
    rotate: degrees(pdfPlacement.rotateDegrees),
  })
}
