import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { normalizeRotation } from '@/managers/PageListManager'
import { rectToCssPercent, rotateRect } from '@/lib/signatureGeometry'
import { displayedPageSizePt, TEXT_LINE_HEIGHT_EM } from '@/lib/annotationGeometry'
import { useElementSize } from '@/hooks/useElementSize'
import { cn } from '@/lib/utils'
import type {
  AnnotationPlacement,
  HighlightPlacement,
  ImagePlacement,
  Rotation,
  TextPlacement,
} from '@/domain/types'

interface AnnotationOverlayProps {
  annotations: AnnotationPlacement[]
  /** Rotation of the frame the overlay sits in (page.rotation, or 0 inside a CSS-rotated wrapper). */
  frameRotation: Rotation
  /** Intrinsic page size from the descriptor (PDF points, or image pixels ≙ points). */
  pageSize: { width: number; height: number }
  /** When provided, each annotation shows a small remove button. */
  onRemove?: (annotationId: string) => void
  className?: string
}

/**
 * Percent-positioned overlay rendering a page's annotations. Rects are stored
 * in the creation-time displayed frame, so each is rotated by the delta
 * between the current frame and the frame at creation — the same convention
 * as `SignatureOverlay`. Text is sized from the page's height in points so
 * the preview matches the exported font size at any zoom.
 */
export function AnnotationOverlay({
  annotations,
  frameRotation,
  pageSize,
  onRemove,
  className,
}: AnnotationOverlayProps) {
  const { ref, size } = useElementSize<HTMLDivElement>()
  const ready = size !== null && size.width > 0 && size.height > 0

  return (
    <div ref={ref} className={cn('pointer-events-none absolute inset-0', className)}>
      {ready &&
        annotations.map((annotation) => (
          <PlacedAnnotation
            key={annotation.id}
            annotation={annotation}
            delta={normalizeRotation(frameRotation - annotation.rotationAtCreate)}
            overlaySize={size}
            pageSize={pageSize}
            onRemove={onRemove}
          />
        ))}
    </div>
  )
}

interface PlacedProps<T extends AnnotationPlacement> {
  annotation: T
  /** Rotation from the creation frame to the current frame. */
  delta: Rotation
  overlaySize: { width: number; height: number }
  pageSize: { width: number; height: number }
  onRemove?: (annotationId: string) => void
}

function PlacedAnnotation(props: PlacedProps<AnnotationPlacement>) {
  const { annotation } = props
  switch (annotation.kind) {
    case 'text':
      return <PlacedText {...props} annotation={annotation} />
    case 'image':
      return <PlacedImage {...props} annotation={annotation} />
    case 'highlight':
      return <PlacedHighlight {...props} annotation={annotation} />
  }
}

function PlacedText({ annotation, delta, overlaySize, pageSize, onRemove }: PlacedProps<TextPlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  const { heightPt } = displayedPageSizePt(pageSize, overlaySize.width / overlaySize.height)
  const fontSizePx = annotation.fontSizePt * (overlaySize.height / heightPt)

  return (
    <div className="absolute" style={rectToCssPercent(displayRect)}>
      <RotatedContent delta={delta} boxRect={displayRect} overlaySize={overlaySize}>
        <div
          className="size-full select-none whitespace-pre"
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: fontSizePx,
            lineHeight: TEXT_LINE_HEIGHT_EM,
            color: annotation.colorHex,
          }}
        >
          {annotation.text}
        </div>
      </RotatedContent>
      {onRemove && <RemoveButton label="Remove text" onClick={() => onRemove(annotation.id)} />}
    </div>
  )
}

function PlacedImage({ annotation, delta, overlaySize, onRemove }: PlacedProps<ImagePlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  return (
    <div className="absolute" style={rectToCssPercent(displayRect)}>
      <RotatedContent delta={delta} boxRect={displayRect} overlaySize={overlaySize}>
        <img src={annotation.dataUrl} alt="" draggable={false} className="size-full select-none" />
      </RotatedContent>
      {onRemove && <RemoveButton label="Remove image" onClick={() => onRemove(annotation.id)} />}
    </div>
  )
}

function PlacedHighlight({ annotation, delta, onRemove }: PlacedProps<HighlightPlacement>) {
  return (
    <>
      {annotation.lineRects.map((lineRect, index) => {
        const displayRect = rotateRect(lineRect, delta)
        return (
          <div
            key={index}
            className="absolute mix-blend-multiply"
            style={{ ...rectToCssPercent(displayRect), backgroundColor: annotation.colorHex }}
          >
            {onRemove && index === 0 && (
              <RemoveButton label="Remove highlight" onClick={() => onRemove(annotation.id)} />
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Content box for rotated placements: sized to the creation-frame rect in
 * pixels and CSS-rotated back into the current frame, centered in its
 * (width/height-swapped) outer box — the same trick `ImageThumbnail` uses.
 */
function RotatedContent({
  delta,
  boxRect,
  overlaySize,
  children,
}: {
  delta: Rotation
  boxRect: { width: number; height: number }
  overlaySize: { width: number; height: number }
  children: ReactNode
}) {
  if (delta === 0) return <div className="absolute inset-0">{children}</div>

  const boxWidthPx = boxRect.width * overlaySize.width
  const boxHeightPx = boxRect.height * overlaySize.height
  const sideways = delta === 90 || delta === 270
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: sideways ? boxHeightPx : boxWidthPx,
        height: sideways ? boxWidthPx : boxHeightPx,
        transform: `translate(-50%, -50%) rotate(${delta}deg)`,
      }}
    >
      {children}
    </div>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pointer-events-auto absolute -right-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full border bg-background text-destructive shadow-sm transition-colors hover:bg-destructive/10"
    >
      <X className="size-3" />
    </button>
  )
}
