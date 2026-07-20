import { X } from 'lucide-react'
import { normalizeRotation } from '@/managers/PageListManager'
import { rectToCssPercent, rotateRect } from '@/lib/signatureGeometry'
import { cn } from '@/lib/utils'
import type { Rotation, SignaturePlacement } from '@/domain/types'
import { useRotatedSignaturePng } from './useRotatedSignaturePng'

interface SignatureOverlayProps {
  signatures: SignaturePlacement[]
  /** Rotation of the frame the overlay sits in (page.rotation, or 0 inside a CSS-rotated wrapper). */
  frameRotation: Rotation
  /** When provided, each signature shows a small remove button. */
  onRemove?: (signatureId: string) => void
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
  className,
}: SignatureOverlayProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)}>
      {signatures.map((signature) => (
        <PlacedSignature
          key={signature.id}
          signature={signature}
          frameRotation={frameRotation}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function PlacedSignature({
  signature,
  frameRotation,
  onRemove,
}: {
  signature: SignaturePlacement
  frameRotation: Rotation
  onRemove?: (signatureId: string) => void
}) {
  const delta = normalizeRotation(frameRotation - signature.rotationAtSign)
  const displayRect = rotateRect(signature.rect, delta)
  const pngUrl = useRotatedSignaturePng(signature.pngDataUrl, delta)
  if (!pngUrl) return null

  return (
    <div className="absolute" style={rectToCssPercent(displayRect)}>
      <img src={pngUrl} alt="" draggable={false} className="size-full select-none" />
      {onRemove && (
        <button
          type="button"
          aria-label="Remove signature"
          title="Remove signature"
          onClick={() => onRemove(signature.id)}
          className="pointer-events-auto absolute -right-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full border bg-background text-destructive shadow-sm transition-colors hover:bg-destructive/10"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
