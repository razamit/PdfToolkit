import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { usePagePreview, type RenderedSize } from '@/hooks/usePagePreview'
import { useElementSize } from '@/hooks/useElementSize'
import { fitBoxWithin } from '@/lib/signatureGeometry'
import { cn } from '@/lib/utils'
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
}

/**
 * Large page preview for annotation modals: renders the page to a canvas and
 * sizes a wrapper to the page's exact aspect, so absolutely-positioned
 * children (drag surfaces, overlays) coincide pixel-for-pixel with the page.
 */
export function PreviewSurface({ page, children, onRenderedSizeChange }: PreviewSurfaceProps) {
  const { canvasRef, ready, renderedSize } = usePagePreview(page)
  const { ref: areaRef, size: areaSize } = useElementSize<HTMLDivElement>()

  useEffect(() => {
    onRenderedSizeChange?.(renderedSize)
  }, [renderedSize, onRenderedSizeChange])

  const fitted =
    renderedSize && areaSize
      ? fitBoxWithin(areaSize, renderedSize.width / renderedSize.height)
      : null

  return (
    <div
      ref={areaRef}
      className="relative flex h-[65dvh] min-h-0 shrink items-center justify-center overflow-hidden bg-muted/30 p-4"
    >
      {!ready && <Loader2 className="absolute size-6 animate-spin text-muted-foreground" />}
      <div
        className={cn('relative transition-opacity', ready && fitted ? 'opacity-100' : 'opacity-0')}
        style={fitted ?? { width: '60%', height: '60%' }}
      >
        <canvas ref={canvasRef} className="size-full bg-white shadow-sm" />
        {renderedSize && fitted && children({ renderedSize, fittedSize: fitted })}
      </div>
    </div>
  )
}
