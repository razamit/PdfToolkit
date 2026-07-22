import { normalizeRotation } from '@/managers/PageListManager'
import { inverseRotation, rectToCssPercent, rotateRect } from '@/lib/signatureGeometry'
import { useElementSize } from '@/hooks/useElementSize'
import { useMarkTransform } from '@/hooks/useMarkTransform'
import { RemoveMarkButton, ResizeMarkHandle } from '@/components/annotations/MarkControls'
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
  onRemove,
  onRectChange,
}: {
  signature: SignaturePlacement
  frameRotation: Rotation
  overlaySize: { width: number; height: number } | null
  onRemove?: (signatureId: string) => void
  onRectChange?: (signatureId: string, rect: NormalizedRect) => void
}) {
  const delta = normalizeRotation(frameRotation - signature.rotationAtSign)
  const displayRect = rotateRect(signature.rect, delta)
  const pngUrl = useRotatedSignaturePng(signature.pngDataUrl, delta)
  const { liveRect, moveHandleProps, resizeHandleProps } = useMarkTransform({
    displayRect,
    overlaySize,
    onCommit: ({ rect }) => onRectChange?.(signature.id, rotateRect(rect, inverseRotation(delta))),
  })
  if (!pngUrl) return null

  const movable = onRectChange !== undefined
  return (
    <div
      {...(movable ? moveHandleProps : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(movable ? liveRect : displayRect)}
    >
      <img src={pngUrl} alt="" draggable={false} className="size-full select-none" />
      {onRemove && (
        <RemoveMarkButton label="Remove signature" onClick={() => onRemove(signature.id)} />
      )}
      {movable && <ResizeMarkHandle handleProps={resizeHandleProps} />}
    </div>
  )
}
