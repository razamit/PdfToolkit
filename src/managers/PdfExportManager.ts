import { PDFDocument, degrees, type PDFPage } from '@cantoo/pdf-lib'
import type { PdfSourceManager } from './PdfSourceManager'
import type { ImageImportManager } from './ImageImportManager'
import type { PageDescriptor, Rotation } from '@/domain/types'

/**
 * Builds the exported PDF losslessly.
 *
 * The output is rebuilt from the original source objects, never from rendered
 * pixels: `copyPages` deep-copies page content streams without decoding,
 * rotation is written as the page's `/Rotate` metadata, and image bytes are
 * embedded directly (JPEG byte-identical; PNG re-encoded losslessly via Flate).
 * Pages are copied once per source for efficiency, then assembled in the
 * user's order.
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
    const copiedPages = await this.copyAllPdfPages(out, pages)

    for (const descriptor of pages) {
      if (descriptor.kind === 'pdf') {
        this.appendPdfPage(out, copiedPages, descriptor)
      } else {
        await this.appendImagePage(out, descriptor)
      }
    }
    // Default save options (object streams on) are lossless; avoid exotic flags.
    return out.save()
  }

  /** Copy every needed PDF page once per source; key is `sourceId:pageIndex`. */
  private async copyAllPdfPages(
    out: PDFDocument,
    pages: PageDescriptor[],
  ): Promise<Map<string, PDFPage>> {
    const indicesBySource = this.groupIndicesBySource(pages)
    const copied = new Map<string, PDFPage>()

    for (const [sourceId, indices] of indicesBySource) {
      const srcDoc = this.sources.getPdfLibDoc(sourceId)
      if (!srcDoc) throw new Error('A PDF source is no longer available for export.')
      const pdfPages = await out.copyPages(srcDoc, indices)
      indices.forEach((pageIndex, i) => copied.set(`${sourceId}:${pageIndex}`, pdfPages[i]))
    }
    return copied
  }

  private groupIndicesBySource(pages: PageDescriptor[]): Map<string, number[]> {
    const grouped = new Map<string, number[]>()
    for (const page of pages) {
      if (page.kind !== 'pdf') continue
      const indices = grouped.get(page.sourceId) ?? []
      if (!indices.includes(page.sourcePageIndex)) indices.push(page.sourcePageIndex)
      grouped.set(page.sourceId, indices)
    }
    return grouped
  }

  private appendPdfPage(
    out: PDFDocument,
    copiedPages: Map<string, PDFPage>,
    descriptor: PageDescriptor,
  ): void {
    const page = copiedPages.get(`${descriptor.sourceId}:${descriptor.sourcePageIndex}`)
    if (!page) throw new Error('A copied page is missing during export.')
    this.applyRotation(page, descriptor.rotation, true)
    out.addPage(page)
  }

  private async appendImagePage(out: PDFDocument, descriptor: PageDescriptor): Promise<void> {
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
