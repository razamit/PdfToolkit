import { useRef, useState, type PointerEventHandler, type Ref } from 'react'
import { Eraser, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useElementSize } from '@/hooks/useElementSize'
import { fitBoxWithin } from '@/lib/signatureGeometry'
import {
  fitStrokesIntoSurface,
  normalizeStrokesToBbox,
  renderStrokesToPng,
} from '@/lib/strokeRendering'
import type {
  NormalizedRect,
  RememberedSignature,
  SignatureStroke,
  StoredSignature,
} from '@/domain/types'
import { useSignatureStrokes } from './useSignatureStrokes'
import { SignatureLibraryPanel } from './SignatureLibraryPanel'

interface DrawHandlers {
  onPointerDown: PointerEventHandler<HTMLCanvasElement>
  onPointerMove: PointerEventHandler<HTMLCanvasElement>
  onPointerUp: PointerEventHandler<HTMLCanvasElement>
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>
}

interface SignatureDrawStepProps {
  /** Width / height of the chosen placement rect, in absolute display units. */
  aspectRatio: number
  /** Session library of previously drawn signatures, selectable as a starting point. */
  library: StoredSignature[]
  onBack: () => void
  onComplete: (
    pngDataUrl: string,
    inkRect: NormalizedRect,
    /** Null when an unmodified library signature was reused (no new library entry). */
    newSignature: RememberedSignature | null,
  ) => void
}

/**
 * Second modal step: a drawing canvas with the chosen rect's aspect ratio,
 * plus a panel of saved signatures that can be loaded onto the canvas. Saving
 * crops the ink to its bounding box, so the placed signature is exactly what
 * is on the canvas (no stretch to the full rect).
 */
export function SignatureDrawStep({
  aspectRatio,
  library,
  onBack,
  onComplete,
}: SignatureDrawStepProps) {
  const { canvasRef, strokes, hasInk, handlers, undo, clear, loadStrokes } = useSignatureStrokes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const loadedStrokesRef = useRef<SignatureStroke[] | null>(null)

  // Reference equality works because every draw/undo/clear produces a new array.
  const isPristineSelection = selectedId !== null && strokes === loadedStrokesRef.current

  const handleSelect = (signature: StoredSignature) => {
    const fitted = fitStrokesIntoSurface(signature, aspectRatio)
    loadedStrokesRef.current = fitted
    setSelectedId(signature.id)
    loadStrokes(fitted)
  }

  const handleSave = () => {
    const rendered = renderStrokesToPng(strokes, aspectRatio)
    if (!rendered) return
    const newSignature = isPristineSelection
      ? null
      : {
          strokes: normalizeStrokesToBbox(strokes, rendered.bbox),
          aspectRatio: rendered.inkAspectRatio,
          pngDataUrl: rendered.dataUrl,
        }
    onComplete(rendered.dataUrl, rendered.bbox, newSignature)
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-[65dvh] min-h-0 shrink flex-col sm:flex-row">
        <DrawSurface aspectRatio={aspectRatio} canvasRef={canvasRef} handlers={handlers} />
        {library.length > 0 && (
          <SignatureLibraryPanel
            signatures={library}
            selectedId={isPristineSelection ? selectedId : null}
            onSelect={handleSelect}
          />
        )}
      </div>

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
      className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-4"
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
