import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { SignatureOverlay } from '@/components/signature/SignatureOverlay'
import { AnnotationOverlay } from './AnnotationOverlay'
import { useMarkSelection } from './markSelectionContext'
import type { PageDescriptor } from '@/domain/types'

/**
 * Everything already placed on a page — signatures and annotations — for
 * modal previews, so every step shows the page exactly as the grid does.
 * Each mark is removable, draggable, and corner-resizable in place
 * (highlights stay fixed — they are anchored to the page's text). Grabbing one
 * also selects it, which rings it here and highlights its row in the items
 * list; selecting from that list rings and scrolls to it the same way.
 * Layers carry no z-index on purpose: DOM order stacks them, and a z-index
 * would create a stacking context that breaks highlight mix-blend-multiply
 * against the page canvas.
 */
export function ExistingMarksOverlay({ page }: { page: PageDescriptor }) {
  const { removeSignature, updateSignatureRect, removeAnnotation, updateAnnotationPlacement } =
    usePdfToolkit()
  const { selectedMarkId, selectMark } = useMarkSelection()

  return (
    <>
      {page.signatures && page.signatures.length > 0 && (
        <SignatureOverlay
          signatures={page.signatures}
          frameRotation={page.rotation}
          selectedId={selectedMarkId}
          onSelect={selectMark}
          onRemove={(signatureId) => removeSignature(page.id, signatureId)}
          onRectChange={(signatureId, rect) => updateSignatureRect(page.id, signatureId, rect)}
        />
      )}
      {page.annotations && page.annotations.length > 0 && (
        <AnnotationOverlay
          annotations={page.annotations}
          frameRotation={page.rotation}
          pageSize={{ width: page.width, height: page.height }}
          selectedId={selectedMarkId}
          onSelect={selectMark}
          onRemove={(annotationId) => removeAnnotation(page.id, annotationId)}
          onTransform={(annotationId, patch) =>
            updateAnnotationPlacement(page.id, annotationId, patch)
          }
        />
      )}
    </>
  )
}
