import type { Worker as TesseractWorker } from 'tesseract.js'
import type { ImageImportManager } from '@/managers/ImageImportManager'
import type { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import type { OcrWordPlacement, PageDescriptor } from '@/domain/types'
import { loadImage } from '@/lib/loadImage'

const OCR_RENDER_WIDTH = 1600
const MIN_WORD_CONFIDENCE = 35

/** Lazy, session-scoped English OCR. Document pixels never leave the browser. */
export class OcrManager {
  private readonly thumbnails: ThumbnailRenderManager
  private readonly images: ImageImportManager
  private workerPromise: Promise<TesseractWorker> | null = null
  private progressListener: ((progress: number, status: string) => void) | null = null

  constructor(thumbnails: ThumbnailRenderManager, images: ImageImportManager) {
    this.thumbnails = thumbnails
    this.images = images
  }

  async recognizePage(
    page: PageDescriptor,
    onProgress: (progress: number, status: string) => void,
  ): Promise<OcrWordPlacement[]> {
    if (page.kind === 'blank') return []
    this.progressListener = onProgress
    const canvas = await this.renderPage(page)
    try {
      const worker = await this.getWorker()
      const result = await worker.recognize(canvas, {}, { text: true, blocks: true })
      return wordsFromBlocks(result.data.blocks, canvas.width, canvas.height, page.rotation)
    } finally {
      canvas.width = 0
      canvas.height = 0
      this.progressListener = null
    }
  }

  async destroy(): Promise<void> {
    const worker = await this.workerPromise?.catch(() => null)
    this.workerPromise = null
    if (worker) await worker.terminate()
  }

  private getWorker(): Promise<TesseractWorker> {
    if (!this.workerPromise) {
      this.workerPromise = import('tesseract.js').then(({ createWorker }) =>
        createWorker('eng', undefined, {
          logger: ({ progress, status }) => this.progressListener?.(progress, status),
        }),
      )
    }
    return this.workerPromise
  }

  private async renderPage(page: PageDescriptor): Promise<HTMLCanvasElement> {
    if (page.kind === 'pdf') {
      const bitmap = await this.thumbnails.render({
        sourceId: page.sourceId,
        pageIndex: page.sourcePageIndex,
        rotation: page.rotation,
        targetWidthPx: OCR_RENDER_WIDTH,
      })
      if (!bitmap) throw new Error('This PDF page could not be rendered for OCR.')
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
      return canvas
    }

    const url = this.images.getObjectUrl(page.sourceId)
    if (!url) throw new Error('This image is no longer available for OCR.')
    const image = await loadImage(url)
    return drawImageForOcr(image, page.rotation)
  }
}

function wordsFromBlocks(
  blocks: Tesseract.Block[] | null,
  width: number,
  height: number,
  rotationAtCreate: PageDescriptor['rotation'],
): OcrWordPlacement[] {
  if (!blocks || width <= 0 || height <= 0) return []
  return blocks
    .flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words)
    .filter((word) => word.text.trim() !== '' && word.confidence >= MIN_WORD_CONFIDENCE)
    .map((word) => ({
      text: word.text.trim(),
      confidence: word.confidence,
      rotationAtCreate,
      rect: {
        x: word.bbox.x0 / width,
        y: word.bbox.y0 / height,
        width: Math.max(1, word.bbox.x1 - word.bbox.x0) / width,
        height: Math.max(1, word.bbox.y1 - word.bbox.y0) / height,
      },
    }))
}

function drawImageForOcr(
  image: HTMLImageElement,
  rotation: PageDescriptor['rotation'],
): HTMLCanvasElement {
  const sideways = rotation === 90 || rotation === 270
  const displayedWidth = sideways ? image.naturalHeight : image.naturalWidth
  const scale = Math.min(1, OCR_RENDER_WIDTH / displayedWidth)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? height : width
  canvas.height = sideways ? width : height
  const context = canvas.getContext('2d')
  context?.save()
  context?.translate(canvas.width / 2, canvas.height / 2)
  context?.rotate((rotation * Math.PI) / 180)
  context?.drawImage(image, -width / 2, -height / 2, width, height)
  context?.restore()
  return canvas
}
