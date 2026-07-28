import { PDFDocument, EncryptedPDFError } from '@cantoo/pdf-lib'
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { pdfjsLib } from '@/lib/pdfjsWorkerSetup'
import { PDFJS_WASM_BASE } from '@/lib/pdfjsAssetPaths'
import { createId } from '@/lib/id'
import { SourceLoadError } from '@/domain/errors'
import type { PageDescriptor, SourceMeta } from '@/domain/types'

interface LoadedPdf {
  meta: SourceMeta
  /** Source document for lossless `copyPages` during export. */
  pdfLibDoc: PDFDocument
  /** Render-only document for thumbnails. */
  pdfjsDoc: PDFDocumentProxy
  /** Loading task owns the worker; destroying it frees pdf.js resources. */
  pdfjsTask: PDFDocumentLoadingTask
}

export interface PdfLoadResult {
  meta: SourceMeta
  pages: PageDescriptor[]
}

/**
 * Ingests PDF files and owns their runtime documents.
 *
 * Quality discipline: the pristine bytes are retained, pdf-lib reads them for
 * the lossless export path, and pdf.js is handed a *separate copy* of the bytes
 * (it may transfer/neuter the buffer it receives — sharing one buffer would
 * leave pdf-lib with a zero-length buffer and silently corrupt the export).
 */
export class PdfSourceManager {
  private readonly loaded = new Map<string, LoadedPdf>()

  async load(file: File): Promise<PdfLoadResult> {
    const originalBytes = new Uint8Array(await file.arrayBuffer())
    const pdfLibDoc = await this.openWithPdfLib(originalBytes, file.name)
    const pdfjsTask = this.openWithPdfjs(originalBytes)
    const pdfjsDoc = await this.awaitPdfjs(pdfjsTask, file.name)

    const id = createId('pdf')
    const meta: SourceMeta = {
      id,
      kind: 'pdf',
      name: file.name,
      originalBytes,
      pageCount: pdfLibDoc.getPageCount(),
    }
    this.loaded.set(id, { meta, pdfLibDoc, pdfjsDoc, pdfjsTask })
    return { meta, pages: this.describePages(id, pdfLibDoc) }
  }

  getPdfLibDoc(sourceId: string): PDFDocument | undefined {
    return this.loaded.get(sourceId)?.pdfLibDoc
  }

  getPdfjsDoc(sourceId: string): PDFDocumentProxy | undefined {
    return this.loaded.get(sourceId)?.pdfjsDoc
  }

  remove(sourceId: string): void {
    const entry = this.loaded.get(sourceId)
    if (!entry) return
    void entry.pdfjsTask.destroy()
    this.loaded.delete(sourceId)
  }

  destroyAll(): void {
    for (const { pdfjsTask } of this.loaded.values()) void pdfjsTask.destroy()
    this.loaded.clear()
  }

  private describePages(sourceId: string, doc: PDFDocument): PageDescriptor[] {
    return doc.getPages().map((page, index) => {
      const { width, height } = page.getSize()
      return {
        id: createId('page'),
        sourceId,
        kind: 'pdf',
        sourcePageIndex: index,
        rotation: 0,
        width,
        height,
      }
    })
  }

  private async openWithPdfLib(bytes: Uint8Array, name: string): Promise<PDFDocument> {
    try {
      return await PDFDocument.load(bytes)
    } catch (error) {
      if (this.isEncrypted(error)) return this.openEncryptedWithPdfLib(bytes, name)
      throw new SourceLoadError(
        `"${name}" could not be read — it may be corrupted or not a valid PDF.`,
      )
    }
  }

  private async openEncryptedWithPdfLib(bytes: Uint8Array, name: string): Promise<PDFDocument> {
    // Owner-only encrypted PDFs decrypt with an empty user password.
    try {
      return await PDFDocument.load(bytes, { password: '' })
    } catch {
      throw new SourceLoadError(`"${name}" is password-protected, which isn't supported.`)
    }
  }

  private isEncrypted(error: unknown): boolean {
    return (
      error instanceof EncryptedPDFError ||
      (error instanceof Error && /encrypt/i.test(error.message))
    )
  }

  private openWithPdfjs(bytes: Uint8Array): PDFDocumentLoadingTask {
    // Hand pdf.js its own copy; an empty password also opens owner-encrypted PDFs.
    // `wasmUrl` is required for scans: JBIG2, CCITT Group 4 and JPEG 2000 images
    // are decoded by WebAssembly modules fetched from this prefix, and without it
    // a scanned page renders blank instead of failing loudly.
    return pdfjsLib.getDocument({
      data: bytes.slice(),
      password: '',
      wasmUrl: PDFJS_WASM_BASE,
    })
  }

  private async awaitPdfjs(
    task: PDFDocumentLoadingTask,
    name: string,
  ): Promise<PDFDocumentProxy> {
    try {
      return await task.promise
    } catch {
      void task.destroy()
      throw new SourceLoadError(
        `"${name}" could not be opened — it may be password-protected or corrupted.`,
      )
    }
  }
}
