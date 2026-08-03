import { PDFDocument, degrees, type PDFPage } from '@cantoo/pdf-lib'
import type { PdfSourceManager } from './PdfSourceManager'
import type { ImageImportManager } from './ImageImportManager'
import { SignatureStamper } from './SignatureStamper'
import { AnnotationStamper } from './annotation/AnnotationStamper'
import { exportScaleFor, resolveTargetExtent } from '@/lib/pageSizing'
import { applyPageCrop } from '@/lib/cropGeometry'
import { decorationsForPage } from '@/lib/exportDecorations'
import { normalizeRotation } from '@/managers/PageListManager'
import type {
  ExportDecorations,
  FormValuesBySource,
  PageDescriptor,
  PageSizeMode,
  Rotation,
  TextPlacement,
} from '@/domain/types'

/** Whether any content (signatures or annotations) is stamped onto this page at export. */
function hasStamps(descriptor: PageDescriptor): boolean {
  return (descriptor.signatures?.length ?? 0) > 0 || (descriptor.annotations?.length ?? 0) > 0
}

interface Stampers {
  signatures: SignatureStamper
  annotations: AnnotationStamper
}

export interface PdfExportOptions {
  decorations?: ExportDecorations
  formValues?: FormValuesBySource
}

/**
 * Builds the exported PDF losslessly.
 *
 * The output is rebuilt from the original source objects, never from rendered
 * pixels: `copyPages` deep-copies page content streams without decoding,
 * rotation is written as the page's `/Rotate` metadata, and image bytes are
 * embedded directly (JPEG byte-identical; PNG re-encoded losslessly via Flate).
 * Unstamped pages are copied once per source and assembled in the user's order;
 * pages with signatures or annotations always get a dedicated copy so a stamp
 * can never leak onto a shared page instance.
 *
 * Page resizing (per-page `exportScale` or the global `pageSizeMode`) is a
 * uniform transform applied after stamping: the embedded content is untouched,
 * only the page box and coordinate matrix change, so quality is preserved and
 * stamps keep their on-page proportions.
 */
export class PdfExportManager {
  private readonly sources: PdfSourceManager
  private readonly images: ImageImportManager

  constructor(sources: PdfSourceManager, images: ImageImportManager) {
    this.sources = sources
    this.images = images
  }

  async export(
    pages: PageDescriptor[],
    pageSizeMode: PageSizeMode = 'original',
    options: PdfExportOptions = {},
  ): Promise<Uint8Array> {
    if (pages.length === 0) throw new Error('There are no pages to export.')

    const out = await PDFDocument.create()
    const stampers: Stampers = {
      signatures: new SignatureStamper(out),
      annotations: new AnnotationStamper(out),
    }
    const sourceDocs = await this.prepareSourceDocuments(pages, options.formValues)
    const copiedPages = await this.copyAllPdfPages(out, pages, sourceDocs)
    const targetExtent =
      pageSizeMode === 'original' ? null : resolveTargetExtent(pageSizeMode, pages)

    for (const [pageIndex, descriptor] of pages.entries()) {
      const scale = exportScaleFor(descriptor, targetExtent)
      if (descriptor.kind === 'pdf') {
        await this.appendPdfPage(
          out,
          copiedPages,
          descriptor,
          stampers,
          scale,
          pageIndex,
          pages.length,
          options.decorations,
        )
      } else if (descriptor.kind === 'image') {
        await this.appendImagePage(
          out,
          descriptor,
          stampers,
          scale,
          pageIndex,
          pages.length,
          options.decorations,
        )
      } else {
        await this.appendBlankPage(
          out,
          descriptor,
          stampers,
          scale,
          pageIndex,
          pages.length,
          options.decorations,
        )
      }
    }
    // Default save options (object streams on) are lossless; avoid exotic flags.
    return out.save()
  }

  /** Unstamped pages: one copy per `sourceId:pageIndex`. Stamped pages: keyed by descriptor id. */
  private async copyAllPdfPages(
    out: PDFDocument,
    pages: PageDescriptor[],
    sourceDocs: Map<string, PDFDocument>,
  ): Promise<Map<string, PDFPage>> {
    const copied = new Map<string, PDFPage>()
    const pdfPages = pages.filter((page) => page.kind === 'pdf')

    const unstampedBySource = this.groupIndicesBySource(pdfPages.filter((p) => !hasStamps(p)))
    for (const [sourceId, indices] of unstampedBySource) {
      const srcPages = await out.copyPages(this.requireSourceDoc(sourceId, sourceDocs), indices)
      indices.forEach((pageIndex, i) => copied.set(`${sourceId}:${pageIndex}`, srcPages[i]))
    }

    for (const descriptor of pdfPages.filter(hasStamps)) {
      const [srcPage] = await out.copyPages(this.requireSourceDoc(descriptor.sourceId, sourceDocs), [
        descriptor.sourcePageIndex,
      ])
      copied.set(descriptor.id, srcPage)
    }
    return copied
  }

  private requireSourceDoc(sourceId: string, sourceDocs: Map<string, PDFDocument>): PDFDocument {
    const srcDoc = sourceDocs.get(sourceId)
    if (!srcDoc) throw new Error('A PDF source is no longer available for export.')
    return srcDoc
  }

  private async prepareSourceDocuments(
    pages: PageDescriptor[],
    values: FormValuesBySource | undefined,
  ): Promise<Map<string, PDFDocument>> {
    const ids = [...new Set(pages.filter((page) => page.kind === 'pdf').map((page) => page.sourceId))]
    const entries = await Promise.all(
      ids.map(async (sourceId) => [
        sourceId,
        await this.sources.createExportDocument(sourceId, values?.[sourceId]),
      ] as const),
    )
    return new Map(entries)
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
    stampers: Stampers,
    scale: number,
    pageIndex: number,
    totalPages: number,
    decorations: ExportDecorations | undefined,
  ): Promise<void> {
    const key = hasStamps(descriptor)
      ? descriptor.id
      : `${descriptor.sourceId}:${descriptor.sourcePageIndex}`
    const page = copiedPages.get(key)
    if (!page) throw new Error('A copied page is missing during export.')

    const intrinsicRotation = page.getRotation().angle
    this.applyRotation(page, descriptor.rotation, true)
    out.addPage(page)
    await this.stampPage(page, descriptor, stampers, intrinsicRotation)
    await this.stampExportLayers(page, descriptor, stampers, intrinsicRotation, pageIndex, totalPages, decorations)
    applyPageCrop(page, descriptor.crop, intrinsicRotation)
    this.scalePage(page, scale)
  }

  private async appendImagePage(
    out: PDFDocument,
    descriptor: PageDescriptor,
    stampers: Stampers,
    scale: number,
    pageIndex: number,
    totalPages: number,
    decorations: ExportDecorations | undefined,
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
    // Image pages are created here with no intrinsic /Rotate.
    await this.stampPage(page, descriptor, stampers, 0)
    await this.stampExportLayers(page, descriptor, stampers, 0, pageIndex, totalPages, decorations)
    applyPageCrop(page, descriptor.crop, 0)
    this.scalePage(page, scale)
  }

  private async appendBlankPage(
    out: PDFDocument,
    descriptor: PageDescriptor,
    stampers: Stampers,
    scale: number,
    pageIndex: number,
    totalPages: number,
    decorations: ExportDecorations | undefined,
  ): Promise<void> {
    const page = out.addPage([descriptor.width, descriptor.height])
    this.applyRotation(page, descriptor.rotation, false)
    await this.stampPage(page, descriptor, stampers, 0)
    await this.stampExportLayers(page, descriptor, stampers, 0, pageIndex, totalPages, decorations)
    applyPageCrop(page, descriptor.crop, 0)
    this.scalePage(page, scale)
  }

  private async stampPage(
    page: PDFPage,
    descriptor: PageDescriptor,
    stampers: Stampers,
    intrinsicRotation: number,
  ): Promise<void> {
    if (descriptor.signatures && descriptor.signatures.length > 0) {
      await stampers.signatures.stampAll(page, descriptor.signatures, intrinsicRotation)
    }
    if (descriptor.annotations && descriptor.annotations.length > 0) {
      await stampers.annotations.stampAll(page, descriptor.annotations, intrinsicRotation)
    }
  }

  private async stampExportLayers(
    page: PDFPage,
    descriptor: PageDescriptor,
    stampers: Stampers,
    intrinsicRotation: number,
    pageIndex: number,
    totalPages: number,
    decorations: ExportDecorations | undefined,
  ): Promise<void> {
    if (descriptor.ocrWords && descriptor.ocrWords.length > 0) {
      const box = page.getCropBox()
      const ocrPlacements: TextPlacement[] = descriptor.ocrWords.map((word, index) => {
        const rotation = normalizeRotation(intrinsicRotation + word.rotationAtCreate)
        const displayedHeight = rotation === 90 || rotation === 270 ? box.width : box.height
        return {
          id: `ocr-${descriptor.id}-${index}`,
          kind: 'text',
          text: word.text,
          rect: word.rect,
          rotationAtCreate: word.rotationAtCreate,
          fontSizePt: Math.max(1, word.rect.height * displayedHeight * 0.78),
          colorHex: '#000000',
          opacity: 0,
        }
      })
      await stampers.annotations.stampAll(page, ocrPlacements, intrinsicRotation)
    }
    if (decorations) {
      const placements = decorationsForPage(descriptor, pageIndex, totalPages, decorations)
      await stampers.annotations.stampAll(page, placements, intrinsicRotation)
    }
  }

  /**
   * Uniformly scale a finished page — boxes, content, and annotations together.
   * Runs after stamping so signatures/annotations shrink or grow with the page
   * (pdf-lib wraps the existing content stream in a scale matrix). Box origins
   * are scaled too, because the matrix scales about (0,0) — pdf-lib's own
   * `page.scale()` leaves origins alone, which drifts non-zero-origin boxes.
   */
  private scalePage(page: PDFPage, factor: number): void {
    if (Math.abs(factor - 1) < 0.001) return
    const media = page.getMediaBox()
    page.setMediaBox(media.x * factor, media.y * factor, media.width * factor, media.height * factor)
    if (page.node.CropBox()) {
      const crop = page.getCropBox()
      page.setCropBox(crop.x * factor, crop.y * factor, crop.width * factor, crop.height * factor)
    }
    page.scaleContent(factor, factor)
    page.scaleAnnotations(factor, factor)
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
