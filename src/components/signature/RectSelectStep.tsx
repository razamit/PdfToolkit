import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePagePreview } from '@/hooks/usePagePreview'
import { useElementSize } from '@/hooks/useElementSize'
import { fitBoxWithin, meetsMinimumSize, rectToCssPercent } from '@/lib/signatureGeometry'
import { cn } from '@/lib/utils'
import type { NormalizedRect, PageDescriptor } from '@/domain/types'
import { SignatureOverlay } from './SignatureOverlay'
import { useRectDrag } from './useRectDrag'

interface RectSelectStepProps {
  page: PageDescriptor
  /** Rect restored when the user comes back from the draw step. */
  initialRect: NormalizedRect | null
  onCancel: () => void
  onContinue: (rect: NormalizedRect, rectAspectRatio: number) => void
  onRemoveSignature: (signatureId: string) => void
}

/**
 * First modal step: a large page preview on which the user drags a rectangle
 * for the signature. Existing signatures are shown and individually removable.
 */
export function RectSelectStep({
  page,
  initialRect,
  onCancel,
  onContinue,
  onRemoveSignature,
}: RectSelectStepProps) {
  const { canvasRef, ready, renderedSize } = usePagePreview(page)
  const { ref: areaRef, size: areaSize } = useElementSize<HTMLDivElement>()
  const { rect, surfaceProps } = useRectDrag(initialRect)
  const canContinue = rect !== null && renderedSize !== null && meetsMinimumSize(rect, renderedSize)

  const fitted =
    renderedSize && areaSize
      ? fitBoxWithin(areaSize, renderedSize.width / renderedSize.height)
      : null

  const handleContinue = () => {
    if (!rect || !renderedSize) return
    const rectAspectRatio = (rect.width * renderedSize.width) / (rect.height * renderedSize.height)
    onContinue(rect, rectAspectRatio)
  }

  return (
    <div className="flex min-h-0 flex-col">
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
          <div
            {...surfaceProps}
            className={cn(
              'absolute inset-0 z-10 touch-none',
              ready ? 'cursor-crosshair' : 'pointer-events-none',
            )}
          />
          {page.signatures && page.signatures.length > 0 && (
            <SignatureOverlay
              signatures={page.signatures}
              frameRotation={page.rotation}
              onRemove={onRemoveSignature}
              className="z-20"
            />
          )}
          {rect && (
            <div
              className="pointer-events-none absolute z-30 border-2 border-primary bg-primary/10"
              style={rectToCssPercent(rect)}
            />
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {canContinue
            ? 'Placement chosen — drag again to adjust.'
            : 'Drag a rectangle on the page where the signature should go.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!canContinue} onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </footer>
    </div>
  )
}
