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
import { useMarkFocus } from '@/hooks/useMarkFocus'
import { selectOnPointerDown, useMarkTransform } from '@/hooks/useMarkTransform'
import { cn } from '@/lib/utils'
import { HighlightInkSvg } from '@/components/freehand/HighlightInkSvg'
import { MarkSelectionRing, RemoveMarkButton, ResizeMarkHandle } from './MarkControls'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  FreehandHighlightPlacement,
  HighlightPlacement,
  ImagePlacement,
  NormalizedRect,
  Rotation,
  SignatureStroke,
  StrokePoint,
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
  /** Id picked out in the editor's items list: ringed here and scrolled into view. */
  selectedId?: string | null
  /** Called when a mark is grabbed on the page, so the list follows the page. */
  onSelect?: (annotationId: string) => void
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
  selectedId,
  onSelect,
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
            selected={annotation.id === selectedId}
            onSelect={onSelect}
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
  /** True when this is the mark picked out in the items list. */
  selected: boolean
  onSelect?: (annotationId: string) => void
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
  selected,
  onSelect,
  onRemove,
  onTransform,
}: PlacedProps<TextPlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  const focusRef = useMarkFocus<HTMLDivElement>(selected)
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
      ref={focusRef}
      {...(movable ? selectOnPointerDown(moveHandleProps, () => onSelect?.(annotation.id)) : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(rect)}
    >
      {selected && <MarkSelectionRing />}
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
  selected,
  onSelect,
  onRemove,
  onTransform,
}: PlacedProps<ImagePlacement>) {
  const displayRect = rotateRect(annotation.rect, delta)
  const focusRef = useMarkFocus<HTMLDivElement>(selected)
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
      ref={focusRef}
      {...(movable ? selectOnPointerDown(moveHandleProps, () => onSelect?.(annotation.id)) : {})}
      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
      style={rectToCssPercent(rect)}
    >
      {selected && <MarkSelectionRing />}
      <RotatedContent delta={delta} boxRect={rect} overlaySize={overlaySize}>
        <img src={annotation.dataUrl} alt="" draggable={false} className="size-full select-none" />
      </RotatedContent>
      {onRemove && <RemoveMarkButton label="Remove image" onClick={() => onRemove(annotation.id)} />}
      {movable && <ResizeMarkHandle handleProps={resizeHandleProps} />}
    </div>
  )
}

function PlacedHighlight({
  annotation,
  delta,
  selected,
  onRemove,
}: PlacedProps<HighlightPlacement>) {
  const displayRects = useMemo(
    () => annotation.lineRects.map((lineRect) => rotateRect(lineRect, delta)),
    [annotation.lineRects, delta],
  )

  return (
    <>
      {displayRects.map((displayRect, index) => (
        <div
          key={index}
          className="absolute mix-blend-multiply"
          style={{ ...rectToCssPercent(displayRect), backgroundColor: annotation.colorHex }}
        />
      ))}
      <FixedMarkAnchor
        rect={rectsBoundingBox(displayRects)}
        selected={selected}
        removeLabel="Remove highlight"
        onRemove={onRemove && (() => onRemove(annotation.id))}
      />
    </>
  )
}

/**
 * A free-hand highlighter mark: strokes rotated into the current frame by
 * `delta` and drawn via the shared ink SVG (single mix-blend-multiply layer).
 * Fixed — it ignores `onTransform`; its remove button and selection ring hang
 * off an anchor box over the strokes' bounding box.
 */
function PlacedFreehandHighlight({
  annotation,
  delta,
  overlaySize,
  selected,
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
      <FixedMarkAnchor
        rect={bbox}
        selected={selected}
        removeLabel="Remove highlight"
        onRemove={onRemove && (() => onRemove(annotation.id))}
      />
    </>
  )
}

/**
 * Invisible box spanning a fixed mark's full extent. Highlights are anchored to
 * the page and have no box of their own to hang controls on, so this carries
 * their remove button and selection ring, and is the element scrolled to when
 * the mark is picked in the items list. It is a sibling of the ink rather than
 * a parent so that `mix-blend-multiply` cannot bleed into either control.
 */
function FixedMarkAnchor({
  rect,
  selected,
  removeLabel,
  onRemove,
}: {
  rect: NormalizedRect | null
  selected: boolean
  removeLabel: string
  onRemove?: () => void
}) {
  const focusRef = useMarkFocus<HTMLDivElement>(selected)
  if (!rect || (!selected && !onRemove)) return null
  return (
    <div ref={focusRef} className="absolute" style={rectToCssPercent(rect)}>
      {selected && <MarkSelectionRing />}
      {onRemove && <RemoveMarkButton label={removeLabel} onClick={onRemove} />}
    </div>
  )
}

/** Tight [0,1] bounding box over every stroke point, or null when there is none. */
function strokesBoundingBox(strokes: SignatureStroke[]): NormalizedRect | null {
  return boundingBox(strokes.flat())
}

/** Tight [0,1] bounding box over every rect, or null when there is none. */
function rectsBoundingBox(rects: NormalizedRect[]): NormalizedRect | null {
  return boundingBox(
    rects.flatMap((rect) => [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
    ]),
  )
}

function boundingBox(points: StrokePoint[]): NormalizedRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
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
