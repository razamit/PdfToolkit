import { normalizeRotation } from '@/managers/PageListManager'
import { inverseRotation, rectToCssPercent, rotateRect } from '@/lib/signatureGeometry'
import { useElementSize } from '@/hooks/useElementSize'
import { useMarkFocus } from '@/hooks/useMarkFocus'
import { selectOnPointerDown, useMarkTransform } from '@/hooks/useMarkTransform'
import {
  MarkSelectionRing,
  RemoveMarkButton,
  ResizeMarkHandle,
} from '@/components/annotations/MarkControls'
import { cn } from '@/lib/utils'
import type { NormalizedRect, Rotation, SignaturePlacement } from '@/domain/types'
import { useRotatedSignaturePng } from './useRotatedSignaturePng'

interface SignatureOverlayProps {
  signatures: SignaturePlacement[]
  /** Rotation of the frame the overlay sits in (page.rotation, or 0 inside a CSS-rotated wrapper). */
  frameRotation: Rotation
  /** When provided, each signature shows a small remove button. */
  onRemove?: (signatureId: string) => void
  /** When provided, signatures can be dragged and corner-resized; receives the new rect in the sign-time frame. */
  onRectChange?: (signatureId: string, rect: NormalizedRect) => void
  /** Id picked out in the editor's items list: ringed here and scrolled into view. */
  selectedId?: string | null
  /** Called when a signature is grabbed on the page, so the list follows the page. */
  onSelect?: (signatureId: string) => void
  className?: string
}

/**
 * Percent-positioned overlay rendering a page's signatures. Each rect is
 * stored in the sign-time displayed frame, so it is rotated by the delta
 * between the current frame and the frame at sign time (PNG included).
 */
export function SignatureOverlay({
  signatures,
  frameRotation,
  onRemove,
  onRectChange,
  selectedId,
  onSelect,
  className,
}: SignatureOverlayProps) {
  const { ref, size } = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className={cn('pointer-events-none absolute inset-0', className)}>
      {signatures.map((signature) => (
        <PlacedSignature
          key={signature.id}
          signature={signature}
          frameRotation={frameRotation}
          overlaySize={size}
          selected={signature.id === selectedId}
          onSelect={onSelect}
          onRemove={onRemove}
          onRectChange={onRectChange}
        />
      ))}
    </div>
  )
}

function PlacedSignature({
  signature,
  frameRotation,
  overlaySize,
  selected,
  onSelect,
  onRemove,
  onRectChange,
}: {
  signature: SignaturePlacement
  frameRotation: Rotation
  overlaySize: { width: number; height: number } | null
  /** True when this is the signature picked out in the items list. */
  selected: boolean
  onSelect?: (signatureId: string) => void
  onRemove?: (signatureId: string) => void
  onRectChange?: (signatureId: string, rect: NormalizedRect) => void
}) {
  const delta = normalizeRotation(frameRotation - signature.rotationAtSign)
  const displayRect = rotateRect(signature.rect, delta)
  const pngUrl = useRotatedSignaturePng(signature.pngDataUrl, delta)
  const focusRef = useMarkFocus<HTMLDivElement>(selected)
  const { liveRect, moveHandleProps, resizeHandleProps } = useMarkTransform({
    displayRect,
    overlaySize,
    onCommit: ({ rect }) => onRectChange?.(signature.id, rotateRect(rect, inverseRotation(delta))),
  })
  if (!pngUrl) return null

  const movable = onRectChange !== undefined
  return (
    <div
      ref={focusRef}
      {...(movable ? selectOnPointerDown(moveHandleProps, () => onSelect?.(signature.id)) : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(movable ? liveRect : displayRect)}
    >
      {selected && <MarkSelectionRing />}
      <img src={pngUrl} alt="" draggable={false} className="size-full select-none" />
      {onRemove && (
        <RemoveMarkButton label="Remove signature" onClick={() => onRemove(signature.id)} />
      )}
      {movable && <ResizeMarkHandle handleProps={resizeHandleProps} />}
    </div>
  )
}
