import type { PdfSourceManager } from './PdfSourceManager'
import type { Rotation } from '@/domain/types'

export interface ThumbnailRequest {
  sourceId: string
  /** 0-based page index within the source PDF. */
  pageIndex: number
  /** User-applied rotation (composed with the page's intrinsic rotation). */
  rotation: Rotation
  /** Target on-screen width of the cell, in CSS pixels. */
  targetWidthPx: number
}

const MAX_CONCURRENT = 3
const MAX_DPR = 2
const CACHE_LIMIT = 240
/** Bucket the target width so the cache holds few size variants, not a continuum. */
const SIZE_BUCKET_PX = 64

/**
 * Renders PDF page thumbnails with pdf.js — display only, never used for export.
 *
 * Bounds memory and work three ways: a concurrency queue (so a 500-page deck
 * doesn't launch 500 render tasks), abortable renders (cells that scroll away
 * cancel mid-flight), and a bounded LRU cache of `ImageBitmap`s keyed by
 * content + rotation + size bucket (so scrolling back and toggling grid size
 * don't re-render).
 */
export class ThumbnailRenderManager {
  private readonly cache = new Map<string, ImageBitmap>()
  private active = 0
  private readonly waiting: Array<() => void> = []
  private readonly sources: PdfSourceManager

  constructor(sources: PdfSourceManager) {
    this.sources = sources
  }

  async render(req: ThumbnailRequest, signal?: AbortSignal): Promise<ImageBitmap | null> {
    const key = this.cacheKey(req)
    const cached = this.cache.get(key)
    if (cached) {
      this.touch(key, cached)
      return cached
    }
    if (signal?.aborted) return null

    return this.withSlot(async () => {
      const existing = this.cache.get(key)
      if (existing) return existing
      if (signal?.aborted) return null
      const bitmap = await this.renderPage(req, signal)
      if (bitmap) this.store(key, bitmap)
      return bitmap
    })
  }

  /** Drop cached thumbnails for a removed source and free their bitmaps. */
  invalidateSource(sourceId: string): void {
    for (const [key, bitmap] of this.cache) {
      if (key.startsWith(`${sourceId}:`)) {
        bitmap.close()
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    for (const bitmap of this.cache.values()) bitmap.close()
    this.cache.clear()
  }

  private async renderPage(req: ThumbnailRequest, signal?: AbortSignal): Promise<ImageBitmap | null> {
    const doc = this.sources.getPdfjsDoc(req.sourceId)
    if (!doc) return null

    const page = await doc.getPage(req.pageIndex + 1)
    if (signal?.aborted) return null

    const rotation = (page.rotate + req.rotation) % 360
    const unscaled = page.getViewport({ scale: 1, rotation })
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const scale = Math.max((req.targetWidthPx * dpr) / unscaled.width, 0.1)
    const viewport = page.getViewport({ scale, rotation })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    const task = page.render({ canvas, viewport })
    const abort = () => task.cancel()
    signal?.addEventListener('abort', abort)
    try {
      await task.promise
    } catch {
      return null // render cancelled or failed
    } finally {
      signal?.removeEventListener('abort', abort)
      page.cleanup()
    }
    if (signal?.aborted) return null

    const bitmap = await createImageBitmap(canvas)
    canvas.width = 0
    canvas.height = 0
    return bitmap
  }

  private cacheKey(req: ThumbnailRequest): string {
    const bucket = Math.round(req.targetWidthPx / SIZE_BUCKET_PX)
    return `${req.sourceId}:${req.pageIndex}:${req.rotation}:${bucket}`
  }

  private touch(key: string, bitmap: ImageBitmap): void {
    this.cache.delete(key)
    this.cache.set(key, bitmap)
  }

  private store(key: string, bitmap: ImageBitmap): void {
    this.cache.set(key, bitmap)
    while (this.cache.size > CACHE_LIMIT) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey === undefined) break
      this.cache.get(oldestKey)?.close()
      this.cache.delete(oldestKey)
    }
  }

  private acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1
        resolve()
      })
    })
  }

  private release(): void {
    this.active -= 1
    this.waiting.shift()?.()
  }

  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}
