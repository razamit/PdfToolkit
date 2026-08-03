import {
  PDFDocument,
  EncryptedPDFError,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from '@cantoo/pdf-lib'
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { pdfjsLib } from '@/lib/pdfjsWorkerSetup'
import { PDFJS_WASM_BASE } from '@/lib/pdfjsAssetPaths'
import { createId } from '@/lib/id'
import { SourceLoadError } from '@/domain/errors'
import { fetchAnnotationFontBytes } from '@/lib/annotationFont'
import type {
  FormFieldDescriptor,
  FormFieldValue,
  PageDescriptor,
  SourceMeta,
} from '@/domain/types'

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

  getMeta(sourceId: string): SourceMeta | undefined {
    return this.loaded.get(sourceId)?.meta
  }

  listFormFields(sourceId: string): FormFieldDescriptor[] {
    const entry = this.loaded.get(sourceId)
    if (!entry) return []
    return entry.pdfLibDoc
      .getForm()
      .getFields()
      .map((field) => describeFormField(sourceId, field))
      .filter((field): field is FormFieldDescriptor => field !== null)
  }

  /**
   * Return a pristine source clone with supported form values applied and all
   * widgets flattened. `copyPages` does not carry an AcroForm tree, whereas
   * flattened appearances are ordinary page content and copy reliably.
   */
  async createExportDocument(
    sourceId: string,
    values: Record<string, FormFieldValue> | undefined,
  ): Promise<PDFDocument> {
    const entry = this.loaded.get(sourceId)
    if (!entry) throw new Error('A PDF source is no longer available for export.')
    const existingFields = entry.pdfLibDoc.getForm().getFields()
    if (existingFields.length === 0) return entry.pdfLibDoc

    const clone = await PDFDocument.load(entry.meta.originalBytes)
    const form = clone.getForm()
    for (const field of form.getFields()) applyFormValue(field, values?.[field.getName()])

    const [{ default: fontkit }, fontBytes] = await Promise.all([
      import('@pdf-lib/fontkit'),
      fetchAnnotationFontBytes(),
    ])
    clone.registerFontkit(fontkit)
    const font = await clone.embedFont(fontBytes, { subset: true })
    form.updateFieldAppearances(font)
    form.flatten()
    return clone
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

function describeFormField(
  sourceId: string,
  field: unknown,
): FormFieldDescriptor | null {
  if (!(field instanceof PDFTextField || field instanceof PDFCheckBox || field instanceof PDFRadioGroup || field instanceof PDFDropdown || field instanceof PDFOptionList)) {
    return null
  }
  const base = { sourceId, name: field.getName(), readOnly: field.isReadOnly() }
  if (field instanceof PDFTextField) {
    return { ...base, kind: 'text', value: field.getText() ?? '' }
  }
  if (field instanceof PDFCheckBox) {
    return { ...base, kind: 'checkbox', value: field.isChecked() }
  }
  if (field instanceof PDFRadioGroup) {
    return {
      ...base,
      kind: 'radio',
      value: field.getSelected() ?? '',
      options: field.getOptions(),
    }
  }
  if (field instanceof PDFDropdown) {
    return {
      ...base,
      kind: 'dropdown',
      value: field.getSelected()[0] ?? '',
      options: field.getOptions(),
    }
  }
  return {
    ...base,
    kind: 'option-list',
    value: field.getSelected(),
    options: field.getOptions(),
  }
}

function applyFormValue(field: unknown, value: FormFieldValue | undefined): void {
  if (value === undefined) return
  if (field instanceof PDFTextField && typeof value === 'string') field.setText(value)
  else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
    if (value) field.check()
    else field.uncheck()
  } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
    if (value) field.select(value)
    else field.clear()
  } else if (field instanceof PDFDropdown && typeof value === 'string') {
    if (value) field.select(value)
    else field.clear()
  } else if (field instanceof PDFOptionList && Array.isArray(value)) {
    if (value.length > 0) field.select(value)
    else field.clear()
  }
}
