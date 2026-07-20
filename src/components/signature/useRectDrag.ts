import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { normalizedPointInBounds } from '@/lib/signatureGeometry'
import type { NormalizedRect, StrokePoint } from '@/domain/types'

/**
 * Drag-a-rectangle gesture on a surface element. Pointer capture keeps the
 * drag alive outside the surface; coordinates are normalized to [0,1] within
 * it. A new drag replaces the previous rect.
 */
export function useRectDrag(initialRect: NormalizedRect | null) {
  const [rect, setRect] = useState<NormalizedRect | null>(initialRect)
  const dragStartRef = useRef<StrokePoint | null>(null)

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointOnSurface(event)
    dragStartRef.current = point
    setRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    if (!start) return
    setRect(rectFromCorners(start, pointOnSurface(event)))
  }, [])

  const endDrag = useCallback(() => {
    dragStartRef.current = null
  }, [])

  return {
    rect,
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

function rectFromCorners(a: StrokePoint, b: StrokePoint): NormalizedRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}
