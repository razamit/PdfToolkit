import { useCallback, useRef, useState, type PointerEvent } from 'react'
import type { NormalizedRect } from '@/domain/types'

/** Result of a completed gesture, in the overlay's displayed frame. */
export interface MarkTransformResult {
  rect: NormalizedRect
  /** Uniform factor the mark was scaled by (1 for pure moves). */
  scale: number
}

/** Pointer handlers to spread onto a mark's body or its resize handle. */
export interface MarkHandleProps {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
}

interface UseMarkTransformOptions {
  /** Committed rect in the current displayed frame. */
  displayRect: NormalizedRect
  /** Overlay size in CSS pixels; gestures are ignored until it is measured. */
  overlaySize: { width: number; height: number } | null
  onCommit: (result: MarkTransformResult) => void
}

/** Smallest fraction either rect side may be resized down to. */
const MIN_SIDE_FRACTION = 0.02

type GestureMode = 'move' | 'resize'

interface GestureStart {
  mode: GestureMode
  clientX: number
  clientY: number
  rect: NormalizedRect
}

/**
 * Move/resize gesture for one placed mark inside a percent-positioned overlay.
 * Dragging the mark translates it; dragging the corner handle scales it
 * uniformly (aspect preserved), clamped inside the page. The transient rect is
 * exposed for rendering and the final one committed on release, still in the
 * displayed frame — callers map it back to their stored frame.
 */
export function useMarkTransform({ displayRect, overlaySize, onCommit }: UseMarkTransformOptions) {
  const gestureRef = useRef<GestureStart | null>(null)
  const liveRef = useRef<MarkTransformResult | null>(null)
  const [live, setLive] = useState<MarkTransformResult | null>(null)

  const beginGesture = useCallback(
    (mode: GestureMode) => (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || !overlaySize) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      gestureRef.current = { mode, clientX: event.clientX, clientY: event.clientY, rect: displayRect }
    },
    [displayRect, overlaySize],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current
      if (!gesture || !overlaySize) return
      const dx = (event.clientX - gesture.clientX) / overlaySize.width
      const dy = (event.clientY - gesture.clientY) / overlaySize.height
      const next =
        gesture.mode === 'move' ? translateRect(gesture.rect, dx, dy) : scaleRect(gesture.rect, dx, dy)
      liveRef.current = next
      setLive(next)
    },
    [overlaySize],
  )

  const endGesture = useCallback(() => {
    if (!gestureRef.current) return
    gestureRef.current = null
    const result = liveRef.current
    liveRef.current = null
    setLive(null)
    if (result) onCommit(result)
  }, [onCommit])

  const handlePropsFor = (mode: GestureMode): MarkHandleProps => ({
    onPointerDown: beginGesture(mode),
    onPointerMove,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
  })

  return {
    /** Rect to render right now: the in-flight gesture rect, else the committed one. */
    liveRect: live?.rect ?? displayRect,
    /** In-flight uniform scale, for live-scaling dependent values (e.g. font size). */
    liveScale: live?.scale ?? 1,
    moveHandleProps: handlePropsFor('move'),
    resizeHandleProps: handlePropsFor('resize'),
  }
}

function translateRect(rect: NormalizedRect, dx: number, dy: number): MarkTransformResult {
  return {
    rect: {
      ...rect,
      x: clampOffset(rect.x + dx, rect.width),
      y: clampOffset(rect.y + dy, rect.height),
    },
    scale: 1,
  }
}

function scaleRect(rect: NormalizedRect, dx: number, dy: number): MarkTransformResult {
  const pulled = Math.max((rect.width + dx) / rect.width, (rect.height + dy) / rect.height)
  const minScale = Math.max(MIN_SIDE_FRACTION / rect.width, MIN_SIDE_FRACTION / rect.height)
  const maxScale = Math.min((1 - rect.x) / rect.width, (1 - rect.y) / rect.height)
  const scale = Math.min(Math.max(pulled, minScale), maxScale)
  return { rect: { ...rect, width: rect.width * scale, height: rect.height * scale }, scale }
}

/** Keep an origin offset inside [0, 1 - side], tolerating sides larger than the page. */
function clampOffset(value: number, side: number): number {
  return Math.min(Math.max(value, 0), Math.max(1 - side, 0))
}
