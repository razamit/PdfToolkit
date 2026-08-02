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
 * list; selecting from that list rings and scrolls to it the same way. Text
 * marks also carry an edit button when the session provides `editTextMark`.
 * Layers carry no z-index on purpose: DOM order stacks them, and a z-index
 * would create a stacking context that breaks highlight mix-blend-multiply
 * against the page canvas.
 */
export function ExistingMarksOverlay({
  page,
  hiddenMarkId,
}: {
  page: PageDescriptor
  /** Mark left out of the overlay — the one currently open in an edit layer. */
  hiddenMarkId?: string
}) {
  const { removeSignature, updateSignatureRect, removeAnnotation, updateAnnotationPlacement } =
    usePdfToolkit()
  const { selectedMarkId, selectMark, editTextMark } = useMarkSelection()
  const signatures = (page.signatures ?? []).filter((signature) => signature.id !== hiddenMarkId)
  const annotations = (page.annotations ?? []).filter(
    (annotation) => annotation.id !== hiddenMarkId,
  )

  return (
    <>
      {signatures.length > 0 && (
        <SignatureOverlay
          signatures={signatures}
          frameRotation={page.rotation}
          selectedId={selectedMarkId}
          onSelect={selectMark}
          onRemove={(signatureId) => removeSignature(page.id, signatureId)}
          onRectChange={(signatureId, rect) => updateSignatureRect(page.id, signatureId, rect)}
        />
      )}
      {annotations.length > 0 && (
        <AnnotationOverlay
          annotations={annotations}
          frameRotation={page.rotation}
          pageSize={{ width: page.width, height: page.height }}
          selectedId={selectedMarkId}
          onSelect={selectMark}
          onRemove={(annotationId) => removeAnnotation(page.id, annotationId)}
          onTransform={(annotationId, patch) =>
            updateAnnotationPlacement(page.id, annotationId, patch)
          }
          onEditText={editTextMark ?? undefined}
        />
      )}
    </>
  )
}
