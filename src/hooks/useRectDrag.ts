import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { clamp01, normalizedPointInBounds } from '@/lib/signatureGeometry'
import type { NormalizedRect, StrokePoint } from '@/domain/types'

/**
 * Movement, as a fraction of the surface, past which a press counts as a drag
 * rather than a click. Below it a `clickRect` press keeps its default-size box,
 * so an unsteady hand still places a box instead of a sliver.
 */
const DRAG_THRESHOLD = 0.012

export interface RectDragOptions {
  /**
   * Normalized size of the box dropped by a plain click. With this set the
   * gesture is click-first: pressing immediately places a usable box at the
   * pointer, and dragging past `DRAG_THRESHOLD` switches to sizing it by hand.
   * Without it the surface is drag-only, which is right for placements that
   * have no sensible default size (a signature, an image crop).
   */
  clickRect?: { width: number; height: number }
}

/**
 * Drag-a-rectangle gesture on a surface element. Pointer capture keeps the
 * drag alive outside the surface; coordinates are normalized to [0,1] within
 * it. A new gesture replaces the previous rect.
 */
export function useRectDrag(
  initialRect: NormalizedRect | null,
  { clickRect }: RectDragOptions = {},
) {
  const [rect, setRect] = useState<NormalizedRect | null>(initialRect)
  const dragStartRef = useRef<StrokePoint | null>(null)
  const draggedRef = useRef(false)

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary) return
      // Suppress the browser's default focus handling for this press. Without
      // it, pressing a non-focusable surface moves focus to <body> *after* the
      // gesture mounts an editor over it, so a freshly placed text box would
      // come up unfocused and the first keystrokes would go nowhere.
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const point = pointOnSurface(event)
      dragStartRef.current = point
      draggedRef.current = false
      setRect(clickRect ? rectAtPoint(point, clickRect) : { ...point, width: 0, height: 0 })
    },
    [clickRect],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current
      if (!start) return
      const point = pointOnSurface(event)
      if (!draggedRef.current) {
        const moved =
          Math.abs(point.x - start.x) > DRAG_THRESHOLD ||
          Math.abs(point.y - start.y) > DRAG_THRESHOLD
        // A click-placed box holds its default size until the press really moves.
        if (clickRect && !moved) return
        draggedRef.current = true
      }
      setRect(rectFromCorners(start, point))
    },
    [clickRect],
  )

  const endDrag = useCallback(() => {
    dragStartRef.current = null
  }, [])

  /** Drop the pending rect — used after committing, so the next click starts clean. */
  const reset = useCallback(() => {
    dragStartRef.current = null
    draggedRef.current = false
    setRect(null)
  }, [])

  return {
    rect,
    reset,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}

function pointOnSurface(event: PointerEvent<HTMLDivElement>): StrokePoint {
  const bounds = event.currentTarget.getBoundingClientRect()
  return normalizedPointInBounds(event.clientX, event.clientY, bounds)
}

/** Default-size box with its top-left at the click, nudged to stay on the page. */
function rectAtPoint(
  point: StrokePoint,
  size: { width: number; height: number },
): NormalizedRect {
  return {
    x: clamp01(Math.min(point.x, 1 - size.width)),
    y: clamp01(Math.min(point.y, 1 - size.height)),
    width: size.width,
    height: size.height,
  }
}

function rectFromCorners(a: StrokePoint, b: StrokePoint): NormalizedRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}
