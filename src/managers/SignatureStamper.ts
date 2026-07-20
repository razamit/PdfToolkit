import { degrees, type PDFDocument, type PDFImage, type PDFPage } from '@cantoo/pdf-lib'
import { normalizeRotation } from './PageListManager'
import { computePdfPlacement } from '@/lib/signatureGeometry'
import type { SignaturePlacement } from '@/domain/types'

/**
 * Stamps drawn signature PNGs onto exported pages. Placement math lives in
 * `signatureGeometry`; this class owns the pdf-lib side: embedding each unique
 * PNG once per export run and issuing the drawImage calls.
 */
export class SignatureStamper {
  private readonly out: PDFDocument
  private readonly embedded = new Map<string, PDFImage>()

  constructor(out: PDFDocument) {
    this.out = out
  }

  /**
   * Draw signatures onto `page`. `intrinsicRotation` is the page's `/Rotate`
   * angle before the user's rotation was applied; each placement composes it
   * with the user rotation captured at sign time.
   */
  async stampAll(
    page: PDFPage,
    signatures: SignaturePlacement[],
    intrinsicRotation: number,
  ): Promise<void> {
    for (const signature of signatures) {
      const image = await this.embed(signature.pngDataUrl)
      this.drawSignature(page, image, signature, intrinsicRotation)
    }
  }

  private drawSignature(
    page: PDFPage,
    image: PDFImage,
    signature: SignaturePlacement,
    intrinsicRotation: number,
  ): void {
    const totalSignRotation = normalizeRotation(intrinsicRotation + signature.rotationAtSign)
    // pdf.js displays the CropBox (pdf-lib falls back to the MediaBox itself).
    const placement = computePdfPlacement(signature.rect, totalSignRotation, page.getCropBox())
    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotate: degrees(placement.rotateDegrees),
    })
  }

  private async embed(pngDataUrl: string): Promise<PDFImage> {
    const cached = this.embedded.get(pngDataUrl)
    if (cached) return cached
    const image = await this.out.embedPng(pngDataUrl)
    this.embedded.set(pngDataUrl, image)
    return image
  }
}
