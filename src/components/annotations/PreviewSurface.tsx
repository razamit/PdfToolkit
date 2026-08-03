import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { usePagePreview, type RenderedSize } from '@/hooks/usePagePreview'
import { useElementSize } from '@/hooks/useElementSize'
import { fitBoxWithin } from '@/lib/signatureGeometry'
import { cn } from '@/lib/utils'
import { cropRectForFrame } from '@/lib/cropGeometry'
import type { PageDescriptor } from '@/domain/types'

export interface PreviewSurfaceContext {
  /** Rendered bitmap size in device pixels (its aspect is the displayed page aspect). */
  renderedSize: RenderedSize
  /** On-screen size of the fitted page box, in CSS pixels. */
  fittedSize: { width: number; height: number }
}

interface PreviewSurfaceProps {
  page: PageDescriptor
  /** Overlays rendered inside the fitted page box once the preview is ready. */
  children: (context: PreviewSurfaceContext) => ReactNode
  /** Lets parents outside the page box (e.g. footers) react to the rendered size. */
  onRenderedSizeChange?: (size: RenderedSize | null) => void
  /** Display scale. 1 fits the page to the area; above that the area scrolls. */
  zoom?: number
}

/**
 * Large page preview for the editing session: renders the page to a canvas and
 * sizes a wrapper to the page's exact aspect, so absolutely-positioned
 * children (drag surfaces, overlays) coincide pixel-for-pixel with the page.
 *
 * Zoom multiplies the fitted box only. Every overlay inside positions itself in
 * percentages of that box, so they all scale with it for free and no overlay
 * needs to know the zoom level. The area scrolls once the box outgrows it, and
 * `usePagePreview` re-renders at a matching resolution so zooming sharpens the
 * page rather than magnifying its pixels.
 */
export function PreviewSurface({
  page,
  children,
  onRenderedSizeChange,
  zoom = 1,
}: PreviewSurfaceProps) {
  const { ref: areaRef, size: areaSize } = useElementSize<HTMLDivElement>()
  const { canvasRef, ready, renderedSize } = usePagePreview(
    page,
    renderTargetWidthPx(areaSize, page, zoom),
  )

  useEffect(() => {
    onRenderedSizeChange?.(renderedSize)
  }, [renderedSize, onRenderedSizeChange])

  const cropRect = cropRectForFrame(page.crop, page.rotation)
  const visibleAspect = renderedSize
    ? (renderedSize.width * cropRect.width) / (renderedSize.height * cropRect.height)
    : null
  const base =
    renderedSize && areaSize
      ? fitBoxWithin(areaSize, visibleAspect ?? renderedSize.width / renderedSize.height)
      : null
  const visibleFitted = base ? { width: base.width * zoom, height: base.height * zoom } : null
  const fullFitted = visibleFitted
    ? { width: visibleFitted.width / cropRect.width, height: visibleFitted.height / cropRect.height }
    : null

  return (
    <div
      ref={areaRef}
      className={cn(
        // Fills the tool column, so the page area tracks the dialog's size
        // (which itself tracks the viewport) instead of a fixed height.
        'relative flex min-h-0 flex-1 bg-muted/30 p-4',
        // A zoomed page is scrolled to, not centred: centring a box larger than
        // its container clips the overflow unreachably in some browsers.
        zoom > 1 ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden',
      )}
    >
      {!ready && <Loader2 className="absolute size-6 animate-spin text-muted-foreground" />}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden transition-opacity',
          ready && visibleFitted ? 'opacity-100' : 'opacity-0',
          zoom > 1 && 'm-auto',
        )}
        style={visibleFitted ?? { width: '60%', height: '60%' }}
      >
        <div
          className="absolute bg-white shadow-sm"
          style={
            fullFitted
              ? {
                  width: fullFitted.width,
                  height: fullFitted.height,
                  left: -cropRect.x * fullFitted.width,
                  top: -cropRect.y * fullFitted.height,
                }
              : undefined
          }
        >
          <canvas ref={canvasRef} className="size-full" />
          {renderedSize && fullFitted && children({ renderedSize, fittedSize: fullFitted })}
        </div>
      </div>
    </div>
  )
}

/**
 * On-screen width the page box will occupy, used to size the render.
 *
 * The exact aspect is only known after a render, and asking for it here would
 * be circular — so this uses the descriptor's aspect in whichever orientation
 * is *wider*. That upper bound costs some over-rendering on portrait pages but
 * never under-renders one whose intrinsic `/Rotate` turns it landscape, which
 * would show as a soft page. Null until the area is measured, so the first
 * render is not made at a guessed size.
 */
function renderTargetWidthPx(
  areaSize: { width: number; height: number } | null,
  page: PageDescriptor,
  zoom: number,
): number | null {
  if (!areaSize || areaSize.width === 0 || areaSize.height === 0) return null
  const aspect = page.width / page.height
  const widest = Math.max(aspect, 1 / aspect)
  return Math.round(fitBoxWithin(areaSize, widest).width * zoom)
}
