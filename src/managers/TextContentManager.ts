import type { PdfSourceManager } from './PdfSourceManager'
import {
  mapTextItemsToRuns,
  type TextItemLike,
  type TextMeasurer,
  type TextRun,
} from '@/lib/textRunGeometry'

/**
 * Canvas-based width measurer used to split items into word runs. Only the
 * *relative* proportions matter, so a generic sans face is a close enough
 * stand-in for the page's embedded fonts.
 */
function createCanvasTextMeasurer(): TextMeasurer {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return (text) => text.length
  context.font = '100px Helvetica, Arial, sans-serif'
  return (text) => context.measureText(text).width
}

/**
 * Extracts text geometry from PDF pages for text-aware highlighting.
 *
 * pdf.js's `getTextContent` is queried once per page; the resulting runs are
 * normalized to the base displayed frame (intrinsic `/Rotate` only, user
 * rotation 0) — the same frame the rendered bitmaps use — and cached as
 * promises so concurrent callers share one extraction. Mapping math lives in
 * `textRunGeometry`; this class owns the pdf.js side and the cache.
 */
export class TextContentManager {
  private readonly sources: PdfSourceManager
  private readonly cache = new Map<string, Promise<TextRun[]>>()
  private readonly measureText: TextMeasurer = createCanvasTextMeasurer()

  constructor(sources: PdfSourceManager) {
    this.sources = sources
  }

  getTextRuns(sourceId: string, pageIndex: number): Promise<TextRun[]> {
    const key = `${sourceId}:${pageIndex}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const pending = this.extract(sourceId, pageIndex)
    this.cache.set(key, pending)
    // Failed extractions are evicted so a later open can retry.
    pending.catch(() => this.cache.delete(key))
    return pending
  }

  invalidateSource(sourceId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sourceId}:`)) this.cache.delete(key)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  private async extract(sourceId: string, pageIndex: number): Promise<TextRun[]> {
    const doc = this.sources.getPdfjsDoc(sourceId)
    if (!doc) return []

    const page = await doc.getPage(pageIndex + 1)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1, rotation: page.rotate })
    const items: TextItemLike[] = []
    for (const item of content.items) {
      if ('str' in item) items.push(item)
    }
    return mapTextItemsToRuns(items, viewport, this.measureText)
  }
}
