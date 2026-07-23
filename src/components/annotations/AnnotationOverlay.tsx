import { useMemo, type ReactNode } from 'react'
import { normalizeRotation } from '@/managers/PageListManager'
import {
  inverseRotation,
  rectToCssPercent,
  rotatePoint,
  rotateRect,
} from '@/lib/signatureGeometry'
import { displayedPageSizePt, TEXT_LINE_HEIGHT_EM } from '@/lib/annotationGeometry'
import { annotationFontFamilyFor } from '@/lib/annotationFont'
import { useElementSize } from '@/hooks/useElementSize'
import { useMarkTransform } from '@/hooks/useMarkTransform'
import { cn } from '@/lib/utils'
import { HighlightInkSvg } from '@/components/freehand/HighlightInkSvg'
import { RemoveMarkButton, ResizeMarkHandle } from './MarkControls'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  FreehandHighlightPlacement,
  HighlightPlacement,
  ImagePlacement,
  NormalizedRect,
  Rotation,
  SignatureStroke,
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
  /**
   * When provided, text and image annotations can be dragged and
   * corner-resized; receives the new geometry in the creation-time frame.
   * Highlights stay fixed — they are anchored to the page's text.
   */
  onTransform?: (annotationId: string, patch: AnnotationPlacementPatch) => void
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
  onTransform,
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
            onTransform={onTransform}
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
  onTransform?: (annotationId: string, patch: AnnotationPlacementPatch) => void
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
    case 'freehand-highlight':
      return <PlacedFreehandHighlight {...props} annotation={annotation} />
  }
}

function PlacedText({
  annotation,
  delta,
  overlaySize,
  pageSize,
  onRemove,
  onTransform,
}: PlacedProps<TextPlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  const { liveRect, liveScale, moveHandleProps, resizeHandleProps } = useMarkTransform({
    displayRect,
    overlaySize,
    onCommit: ({ rect, scale }) =>
      onTransform?.(annotation.id, {
        rect: rotateRect(rect, inverseRotation(delta)),
        fontSizePt: annotation.fontSizePt * scale,
      }),
  })
  const { heightPt } = displayedPageSizePt(pageSize, overlaySize.width / overlaySize.height)
  const fontSizePx = annotation.fontSizePt * liveScale * (overlaySize.height / heightPt)
  const movable = onTransform !== undefined
  const rect = movable ? liveRect : displayRect

  return (
    <div
      {...(movable ? moveHandleProps : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(rect)}
    >
      <RotatedContent delta={delta} boxRect={rect} overlaySize={overlaySize}>
        <div
          dir="auto"
          className="size-full select-none whitespace-pre"
          style={{
            fontFamily: annotationFontFamilyFor(annotation.text),
            fontSize: fontSizePx,
            lineHeight: TEXT_LINE_HEIGHT_EM,
            color: annotation.colorHex,
          }}
        >
          {annotation.text}
        </div>
      </RotatedContent>
      {onRemove && <RemoveMarkButton label="Remove text" onClick={() => onRemove(annotation.id)} />}
      {movable && <ResizeMarkHandle handleProps={resizeHandleProps} />}
    </div>
  )
}

function PlacedImage({
  annotation,
  delta,
  overlaySize,
  onRemove,
  onTransform,
}: PlacedProps<ImagePlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  const { liveRect, moveHandleProps, resizeHandleProps } = useMarkTransform({
    displayRect,
    overlaySize,
    onCommit: ({ rect }) =>
      onTransform?.(annotation.id, { rect: rotateRect(rect, inverseRotation(delta)) }),
  })
  const movable = onTransform !== undefined
  const rect = movable ? liveRect : displayRect

  return (
    <div
      {...(movable ? moveHandleProps : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(rect)}
    >
      <RotatedContent delta={delta} boxRect={rect} overlaySize={overlaySize}>
        <img src={annotation.dataUrl} alt="" draggable={false} className="size-full select-none" />
      </RotatedContent>
      {onRemove && <RemoveMarkButton label="Remove image" onClick={() => onRemove(annotation.id)} />}
      {movable && <ResizeMarkHandle handleProps={resizeHandleProps} />}
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
              <RemoveMarkButton label="Remove highlight" onClick={() => onRemove(annotation.id)} />
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * A free-hand highlighter mark: strokes rotated into the current frame by
 * `delta` and drawn via the shared ink SVG (single mix-blend-multiply layer).
 * Fixed — it ignores `onTransform`; a remove button sits at the strokes'
 * bounding-box top when removal is offered (e.g. in Move & resize).
 */
function PlacedFreehandHighlight({
  annotation,
  delta,
  overlaySize,
  onRemove,
}: PlacedProps<FreehandHighlightPlacement>) {
  const rotated = useMemo(
    () => annotation.strokes.map((stroke) => stroke.map((point) => rotatePoint(point, delta))),
    [annotation.strokes, delta],
  )
  const bbox = useMemo(() => strokesBoundingBox(rotated), [rotated])
  return (
    <>
      <HighlightInkSvg
        strokes={rotated}
        colorHex={annotation.colorHex}
        thickness={annotation.thickness}
        surface={overlaySize}
      />
      {onRemove && bbox && (
        <div className="absolute" style={rectToCssPercent(bbox)}>
          <RemoveMarkButton label="Remove highlight" onClick={() => onRemove(annotation.id)} />
        </div>
      )}
    </>
  )
}

/** Tight [0,1] bounding box over every stroke point, or null when there is none. */
function strokesBoundingBox(strokes: SignatureStroke[]): NormalizedRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
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
