import { useMemo, type PointerEventHandler, type Ref } from 'react'

interface DrawHandlers {
  onPointerDown: PointerEventHandler<HTMLCanvasElement>
  onPointerMove: PointerEventHandler<HTMLCanvasElement>
  onPointerUp: PointerEventHandler<HTMLCanvasElement>
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>
}
import { Eraser, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useElementSize } from '@/hooks/useElementSize'
import { fitBoxWithin } from '@/lib/signatureGeometry'
import {
  fitStrokesIntoSurface,
  normalizeStrokesToBbox,
  renderStrokesToPng,
} from '@/lib/strokeRendering'
import type { NormalizedRect, RememberedSignature } from '@/domain/types'
import { useSignatureStrokes } from './useSignatureStrokes'

interface SignatureDrawStepProps {
  /** Width / height of the chosen placement rect, in absolute display units. */
  aspectRatio: number
  /** Session's last drawn signature, pre-filled onto the surface when present. */
  initialSignature: RememberedSignature | null
  onBack: () => void
  onComplete: (
    pngDataUrl: string,
    inkRect: NormalizedRect,
    remembered: RememberedSignature,
  ) => void
}

/**
 * Second modal step: a drawing canvas with the chosen rect's aspect ratio.
 * Saving crops the ink to its bounding box, so the placed signature is exactly
 * what was drawn (no stretch to the full rect).
 */
export function SignatureDrawStep({
  aspectRatio,
  initialSignature,
  onBack,
  onComplete,
}: SignatureDrawStepProps) {
  const seedStrokes = useMemo(
    () => (initialSignature ? fitStrokesIntoSurface(initialSignature, aspectRatio) : []),
    [initialSignature, aspectRatio],
  )
  const { canvasRef, strokes, hasInk, handlers, undo, clear } = useSignatureStrokes(seedStrokes)

  const handleSave = () => {
    const rendered = renderStrokesToPng(strokes, aspectRatio)
    if (!rendered) return
    onComplete(rendered.dataUrl, rendered.bbox, {
      strokes: normalizeStrokesToBbox(strokes, rendered.bbox),
      aspectRatio: rendered.inkAspectRatio,
    })
  }

  return (
    <div className="flex min-h-0 flex-col">
      <DrawSurface aspectRatio={aspectRatio} canvasRef={canvasRef} handlers={handlers} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!hasInk} onClick={undo}>
            <Undo2 />
            Undo
          </Button>
          <Button variant="ghost" size="sm" disabled={!hasInk} onClick={clear}>
            <Eraser />
            Clear
          </Button>
          <Button disabled={!hasInk} onClick={handleSave}>
            Save signature
          </Button>
        </div>
      </footer>
    </div>
  )
}

function DrawSurface({
  aspectRatio,
  canvasRef,
  handlers,
}: {
  aspectRatio: number
  canvasRef: Ref<HTMLCanvasElement>
  handlers: DrawHandlers
}) {
  const { ref: areaRef, size } = useElementSize<HTMLDivElement>()
  const fitted = size ? fitBoxWithin(size, aspectRatio) : null

  return (
    <div
      ref={areaRef}
      className="flex h-[65dvh] min-h-0 shrink items-center justify-center overflow-hidden bg-muted/30 p-4"
    >
      {fitted && fitted.width > 0 && (
        <canvas
          ref={canvasRef}
          {...handlers}
          style={{ width: fitted.width, height: fitted.height }}
          className="cursor-crosshair touch-none rounded-xl border-2 border-dashed border-muted-foreground/30 bg-white shadow-sm"
        />
      )}
    </div>
  )
}
