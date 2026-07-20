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
 * Renders a large preview of one page onto a canvas for the signature modal.
 * PDF pages reuse the thumbnail render pipeline (queue, cache, DPR); image
 * pages are drawn rotated straight from their object URL. Output is uniform:
 * a canvas ref, a ready flag, and the rendered pixel size.
 */
export function usePagePreview(page: PageDescriptor) {
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
        ? renderPdfPreview(canvas, thumbnailRenderer, sourceId, sourcePageIndex, rotation, controller.signal)
        : renderImagePreview(canvas, imageManager, sourceId, rotation, controller.signal)

    render
      .then((size) => {
        if (!controller.signal.aborted && size) setRenderedSize(size)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [kind, sourceId, sourcePageIndex, rotation, thumbnailRenderer, imageManager])

  return { canvasRef, ready: renderedSize !== null, renderedSize }
}

function previewTargetWidthPx(): number {
  return Math.min(MAX_PREVIEW_WIDTH_PX, window.innerWidth * 1.5)
}

async function renderPdfPreview(
  canvas: HTMLCanvasElement,
  renderer: ThumbnailRenderManager,
  sourceId: string,
  pageIndex: number,
  rotation: Rotation,
  signal: AbortSignal,
): Promise<RenderedSize | null> {
  const bitmap = await renderer.render(
    { sourceId, pageIndex, rotation, targetWidthPx: previewTargetWidthPx() },
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
