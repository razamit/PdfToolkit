import { PDFDocument, degrees, type PDFPage } from '@cantoo/pdf-lib'
import type { PdfSourceManager } from './PdfSourceManager'
import type { ImageImportManager } from './ImageImportManager'
import { SignatureStamper } from './SignatureStamper'
import type { PageDescriptor, Rotation } from '@/domain/types'

function hasSignatures(descriptor: PageDescriptor): boolean {
  return (descriptor.signatures?.length ?? 0) > 0
}

/**
 * Builds the exported PDF losslessly.
 *
 * The output is rebuilt from the original source objects, never from rendered
 * pixels: `copyPages` deep-copies page content streams without decoding,
 * rotation is written as the page's `/Rotate` metadata, and image bytes are
 * embedded directly (JPEG byte-identical; PNG re-encoded losslessly via Flate).
 * Unsigned pages are copied once per source and assembled in the user's order;
 * signed pages always get a dedicated copy so a stamp can never leak onto a
 * shared page instance.
 */
export class PdfExportManager {
  private readonly sources: PdfSourceManager
  private readonly images: ImageImportManager

  constructor(sources: PdfSourceManager, images: ImageImportManager) {
    this.sources = sources
    this.images = images
  }

  async export(pages: PageDescriptor[]): Promise<Uint8Array> {
    if (pages.length === 0) throw new Error('There are no pages to export.')

    const out = await PDFDocument.create()
    const stamper = new SignatureStamper(out)
    const copiedPages = await this.copyAllPdfPages(out, pages)

    for (const descriptor of pages) {
      if (descriptor.kind === 'pdf') {
        await this.appendPdfPage(out, copiedPages, descriptor, stamper)
      } else {
        await this.appendImagePage(out, descriptor, stamper)
      }
    }
    // Default save options (object streams on) are lossless; avoid exotic flags.
    return out.save()
  }

  /** Unsigned pages: one copy per `sourceId:pageIndex`. Signed pages: keyed by descriptor id. */
  private async copyAllPdfPages(
    out: PDFDocument,
    pages: PageDescriptor[],
  ): Promise<Map<string, PDFPage>> {
    const copied = new Map<string, PDFPage>()
    const pdfPages = pages.filter((page) => page.kind === 'pdf')

    const unsignedBySource = this.groupIndicesBySource(pdfPages.filter((p) => !hasSignatures(p)))
    for (const [sourceId, indices] of unsignedBySource) {
      const srcPages = await out.copyPages(this.requireSourceDoc(sourceId), indices)
      indices.forEach((pageIndex, i) => copied.set(`${sourceId}:${pageIndex}`, srcPages[i]))
    }

    for (const descriptor of pdfPages.filter(hasSignatures)) {
      const [srcPage] = await out.copyPages(this.requireSourceDoc(descriptor.sourceId), [
        descriptor.sourcePageIndex,
      ])
      copied.set(descriptor.id, srcPage)
    }
    return copied
  }

  private requireSourceDoc(sourceId: string): PDFDocument {
    const srcDoc = this.sources.getPdfLibDoc(sourceId)
    if (!srcDoc) throw new Error('A PDF source is no longer available for export.')
    return srcDoc
  }

  private groupIndicesBySource(pages: PageDescriptor[]): Map<string, number[]> {
    const grouped = new Map<string, number[]>()
    for (const page of pages) {
      const indices = grouped.get(page.sourceId) ?? []
      if (!indices.includes(page.sourcePageIndex)) indices.push(page.sourcePageIndex)
      grouped.set(page.sourceId, indices)
    }
    return grouped
  }

  private async appendPdfPage(
    out: PDFDocument,
    copiedPages: Map<string, PDFPage>,
    descriptor: PageDescriptor,
    stamper: SignatureStamper,
  ): Promise<void> {
    const key = hasSignatures(descriptor)
      ? descriptor.id
      : `${descriptor.sourceId}:${descriptor.sourcePageIndex}`
    const page = copiedPages.get(key)
    if (!page) throw new Error('A copied page is missing during export.')

    const intrinsicRotation = page.getRotation().angle
    this.applyRotation(page, descriptor.rotation, true)
    out.addPage(page)
    if (descriptor.signatures && descriptor.signatures.length > 0) {
      await stamper.stampAll(page, descriptor.signatures, intrinsicRotation)
    }
  }

  private async appendImagePage(
    out: PDFDocument,
    descriptor: PageDescriptor,
    stamper: SignatureStamper,
  ): Promise<void> {
    const meta = this.images.getMeta(descriptor.sourceId)
    if (!meta?.imageFormat) throw new Error('An image source is no longer available for export.')

    const image =
      meta.imageFormat === 'jpeg'
        ? await out.embedJpg(meta.originalBytes)
        : await out.embedPng(meta.originalBytes)

    // Page sized to the image's natural pixel dimensions: 1pt ↔ 1px, full resolution.
    const page = out.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    this.applyRotation(page, descriptor.rotation, false)
    if (descriptor.signatures && descriptor.signatures.length > 0) {
      // Image pages are created here with no intrinsic /Rotate.
      await stamper.stampAll(page, descriptor.signatures, 0)
    }
  }

  /**
   * Apply the user's rotation to a page. When `compose` is true (copied PDF
   * pages may already carry a `/Rotate`), we add to the existing angle because
   * `setRotation` *replaces* rather than accumulates. Image pages start at 0.
   */
  private applyRotation(page: PDFPage, rotation: Rotation, compose: boolean): void {
    if (rotation === 0 && !compose) return
    const base = compose ? page.getRotation().angle : 0
    page.setRotation(degrees((base + rotation) % 360))
  }
}
