import { useEffect, useRef, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { loadImage } from '@/lib/loadImage'
import type { ImageImportManager } from '@/managers/ImageImportManager'
import type { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import type { PageDescriptor, Rotation } from '@/domain/types'

export interface RenderedSize {
  width: number
  height: number
}

const MAX_PREVIEW_WIDTH_PX = 1200
const MAX_PREVIEW_DPR = 2
/**
 * Ceiling on the requested render width, in CSS px. The renderer multiplies by
 * the device pixel ratio (capped at 2), so this bounds a single page bitmap to
 * roughly 3200 device px wide — about what the deepest zoom level can actually
 * show, and the difference between a ~58 MB allocation and a ~130 MB one.
 */
const MAX_PREVIEW_RENDER_WIDTH_PX = 1600

/**
 * Renders a large preview of one page onto a canvas for the editing session.
 * PDF pages reuse the thumbnail render pipeline (queue, cache, DPR); image
 * pages are drawn rotated straight from their object URL. Output is uniform:
 * a canvas ref, a ready flag, and the rendered pixel size.
 *
 * `targetWidthPx` is the on-screen width the caller intends to display the page
 * at, zoom included. Passing it makes the bitmap track the pixels it will
 * actually fill: a zoomed page is re-rendered sharp instead of magnified, and
 * an unzoomed one stops being rendered several times larger than its box. Pass
 * null before the layout has been measured and a conservative default is used.
 * The renderer's cache is keyed by a width bucket, so returning to a zoom level
 * already visited is a cache hit rather than a re-render.
 */
export function usePagePreview(page: PageDescriptor, targetWidthPx?: number | null) {
  const { thumbnailRenderer, imageManager } = usePdfToolkit()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [renderedSize, setRenderedSize] = useState<RenderedSize | null>(null)

  const { kind, sourceId, sourcePageIndex, rotation } = page
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = new AbortController()
    setRenderedSize(null)

    const render =
      kind === 'pdf'
        ? renderPdfPreview(
            canvas,
            thumbnailRenderer,
            sourceId,
            sourcePageIndex,
            rotation,
            targetWidthPx,
            controller.signal,
          )
        : renderImagePreview(canvas, imageManager, sourceId, rotation, controller.signal)

    render
      .then((size) => {
        if (!controller.signal.aborted && size) setRenderedSize(size)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [kind, sourceId, sourcePageIndex, rotation, targetWidthPx, thumbnailRenderer, imageManager])

  return { canvasRef, ready: renderedSize !== null, renderedSize }
}

/** Requested width, or a viewport-derived default until the layout is measured. */
function previewTargetWidthPx(requested?: number | null): number {
  const width = requested ?? Math.min(MAX_PREVIEW_WIDTH_PX, window.innerWidth * 1.5)
  return Math.min(MAX_PREVIEW_RENDER_WIDTH_PX, Math.max(1, width))
}

async function renderPdfPreview(
  canvas: HTMLCanvasElement,
  renderer: ThumbnailRenderManager,
  sourceId: string,
  pageIndex: number,
  rotation: Rotation,
  requestedWidthPx: number | null | undefined,
  signal: AbortSignal,
): Promise<RenderedSize | null> {
  const bitmap = await renderer.render(
    { sourceId, pageIndex, rotation, targetWidthPx: previewTargetWidthPx(requestedWidthPx) },
    signal,
  )
  if (!bitmap || signal.aborted) return null
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  return { width: bitmap.width, height: bitmap.height }
}

async function renderImagePreview(
  canvas: HTMLCanvasElement,
  images: ImageImportManager,
  sourceId: string,
  rotation: Rotation,
  signal: AbortSignal,
): Promise<RenderedSize | null> {
  const url = images.getObjectUrl(sourceId)
  if (!url) return null
  const image = await loadImage(url)
  if (signal.aborted) return null
  return drawRotatedImage(canvas, image, rotation)
}

/** Draw the image rotated into the canvas, downscaled to the preview budget. */
function drawRotatedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  rotation: Rotation,
): RenderedSize {
  const sideways = rotation === 90 || rotation === 270
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_PREVIEW_DPR)
  const displayedWidth = sideways ? image.naturalHeight : image.naturalWidth
  const scale = Math.min(1, (previewTargetWidthPx() * dpr) / displayedWidth)
  const drawWidth = Math.max(1, Math.round(image.naturalWidth * scale))
  const drawHeight = Math.max(1, Math.round(image.naturalHeight * scale))

  canvas.width = sideways ? drawHeight : drawWidth
  canvas.height = sideways ? drawWidth : drawHeight
  const context = canvas.getContext('2d')
  if (context) {
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((rotation * Math.PI) / 180)
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    context.restore()
  }
  return { width: canvas.width, height: canvas.height }
}
