import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { meetsMinimumSize, rectToCssPercent } from '@/lib/signatureGeometry'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useRectDrag } from '@/components/signature/useRectDrag'
import { SignatureOverlay } from '@/components/signature/SignatureOverlay'
import { PreviewSurface } from './PreviewSurface'
import { AnnotationOverlay } from './AnnotationOverlay'
import type { NormalizedRect, PageDescriptor } from '@/domain/types'
import type { RenderedSize } from '@/hooks/usePagePreview'

interface RectChooseStepProps {
  page: PageDescriptor
  /** Rect restored when the user comes back from a later step. */
  initialRect: NormalizedRect | null
  instruction: string
  confirmedInstruction: string
  onCancel: () => void
  /** `rectAspectRatio` is the chosen rect's on-screen width / height. */
  onContinue: (rect: NormalizedRect, rectAspectRatio: number) => void
}

/**
 * Generic first step for annotation modals: drag a rectangle on the page
 * preview. Existing signatures and annotations are shown for context, and
 * annotations are individually removable.
 */
export function RectChooseStep({
  page,
  initialRect,
  instruction,
  confirmedInstruction,
  onCancel,
  onContinue,
}: RectChooseStepProps) {
  const { removeAnnotation } = usePdfToolkit()
  const { rect, surfaceProps } = useRectDrag(initialRect)
  const [renderedSize, setRenderedSize] = useState<RenderedSize | null>(null)
  const canContinue = rect !== null && renderedSize !== null && meetsMinimumSize(rect, renderedSize)

  const handleContinue = () => {
    if (!rect || !renderedSize) return
    const rectAspectRatio = (rect.width * renderedSize.width) / (rect.height * renderedSize.height)
    onContinue(rect, rectAspectRatio)
  }

  return (
    <div className="flex min-h-0 flex-col">
      <PreviewSurface page={page} onRenderedSizeChange={setRenderedSize}>
        {() => (
          <>
            <div {...surfaceProps} className="absolute inset-0 z-10 cursor-crosshair touch-none" />
            {page.signatures && page.signatures.length > 0 && (
              <SignatureOverlay
                signatures={page.signatures}
                frameRotation={page.rotation}
                className="z-20"
              />
            )}
            {page.annotations && page.annotations.length > 0 && (
              <AnnotationOverlay
                annotations={page.annotations}
                frameRotation={page.rotation}
                pageSize={{ width: page.width, height: page.height }}
                onRemove={(annotationId) => removeAnnotation(page.id, annotationId)}
                className="z-20"
              />
            )}
            {rect && (
              <div
                className="pointer-events-none absolute z-30 border-2 border-primary bg-primary/10"
                style={rectToCssPercent(rect)}
              />
            )}
          </>
        )}
      </PreviewSurface>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {canContinue ? confirmedInstruction : instruction}
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
