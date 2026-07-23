import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { normalizedPointInBounds } from '@/lib/signatureGeometry'
import type { SignatureStroke, StrokePoint } from '@/domain/types'

export type FreehandMode = 'freehand' | 'line'

/**
 * Captures pointer strokes over a capture layer in normalized [0,1]
 * coordinates, with two modes:
 * - `freehand` — every move appends a point to the current stroke.
 * - `line` — the down seeds a `[start, start]` segment and each move *replaces*
 *   the endpoint, so the stroke stays a straight `[start, current]` two-pointer.
 *
 * Pure state (no canvas/DPR machinery) — the preview is an SVG. Points are
 * normalized against the capture layer's own rect, exactly like the signature
 * hook, so a stroke is stored in the page box's displayed frame.
 */
export function useFreehandStrokes(mode: FreehandMode) {
  const [strokes, setStrokes] = useState<SignatureStroke[]>([])
  const isDrawingRef = useRef(false)
  // Read inside the state updaters so a mid-gesture mode change can't go stale.
  const modeRef = useRef(mode)
  modeRef.current = mode

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDrawingRef.current = true
    const point = pointOnLayer(event)
    setStrokes((previous) => [
      ...previous,
      modeRef.current === 'line' ? [point, point] : [point],
    ])
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current) return
    const point = pointOnLayer(event)
    setStrokes((previous) =>
      modeRef.current === 'line'
        ? replaceLastPoint(previous, point)
        : appendToLastStroke(previous, point),
    )
  }, [])

  const endStroke = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  const undo = useCallback(() => setStrokes((previous) => previous.slice(0, -1)), [])
  const clear = useCallback(() => setStrokes([]), [])

  return {
    strokes,
    hasInk: strokes.length > 0,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endStroke,
      onPointerCancel: endStroke,
    },
    undo,
    clear,
  }
}

function pointOnLayer(event: PointerEvent<HTMLDivElement>): StrokePoint {
  const bounds = event.currentTarget.getBoundingClientRect()
  return normalizedPointInBounds(event.clientX, event.clientY, bounds)
}

function appendToLastStroke(
  strokes: SignatureStroke[],
  point: StrokePoint,
): SignatureStroke[] {
  if (strokes.length === 0) return strokes
  const next = strokes.slice()
  next[next.length - 1] = [...next[next.length - 1], point]
  return next
}

/** Keep the last stroke a straight `[start, current]` segment (line mode). */
function replaceLastPoint(
  strokes: SignatureStroke[],
  point: StrokePoint,
): SignatureStroke[] {
  if (strokes.length === 0) return strokes
  const next = strokes.slice()
  const last = next[next.length - 1]
  next[next.length - 1] = [last[0], point]
  return next
}
