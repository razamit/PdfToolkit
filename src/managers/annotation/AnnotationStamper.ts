import {
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib'
import { normalizeRotation } from '@/managers/PageListManager'
import { stampTextAnnotation } from './TextStamper'
import { stampImageAnnotation } from './ImageStamper'
import { stampHighlightAnnotation } from './HighlightStamper'
import type { AnnotationPlacement, ImagePlacement } from '@/domain/types'

/**
 * Stamps text/image/highlight annotations onto exported pages. Drawing math
 * lives in the per-kind stampers; this facade owns the pdf-lib resources
 * shared across a run: the Helvetica font and each unique embedded image.
 */
export class AnnotationStamper {
  private readonly out: PDFDocument
  private helvetica: PDFFont | null = null
  private readonly embeddedImages = new Map<string, PDFImage>()

  constructor(out: PDFDocument) {
    this.out = out
  }

  /**
   * Draw annotations onto `page`. `intrinsicRotation` is the page's `/Rotate`
   * angle before the user's rotation was applied; each placement composes it
   * with the user rotation frozen at creation time.
   */
  async stampAll(
    page: PDFPage,
    annotations: AnnotationPlacement[],
    intrinsicRotation: number,
  ): Promise<void> {
    for (const annotation of annotations) {
      const totalRotation = normalizeRotation(intrinsicRotation + annotation.rotationAtCreate)
      switch (annotation.kind) {
        case 'text':
          stampTextAnnotation(page, annotation, totalRotation, this.getHelvetica())
          break
        case 'image':
          stampImageAnnotation(page, annotation, totalRotation, await this.embedImage(annotation))
          break
        case 'highlight':
          stampHighlightAnnotation(page, annotation, totalRotation)
          break
      }
    }
  }

  private getHelvetica(): PDFFont {
    if (!this.helvetica) this.helvetica = this.out.embedStandardFont(StandardFonts.Helvetica)
    return this.helvetica
  }

  private async embedImage(placement: ImagePlacement): Promise<PDFImage> {
    const cached = this.embeddedImages.get(placement.dataUrl)
    if (cached) return cached
    const image =
      placement.format === 'jpeg'
        ? await this.out.embedJpg(placement.dataUrl)
        : await this.out.embedPng(placement.dataUrl)
    this.embeddedImages.set(placement.dataUrl, image)
    return image
  }
}
