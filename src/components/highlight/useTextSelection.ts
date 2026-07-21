import { useCallback, useMemo, useRef, useState, type PointerEvent } from 'react'
import { normalizedPointInBounds } from '@/lib/signatureGeometry'
import type { TextRun } from '@/lib/textRunGeometry'
import type { NormalizedRect, StrokePoint } from '@/domain/types'

/** Fraction of a run's height added above and below when hit-testing. */
const VERTICAL_INFLATION = 0.3
/** Maximum normalized distance from a run at which a pointer still snaps to it. */
const SNAP_DISTANCE = 0.015

interface SelectionRange {
  anchor: number
  focus: number
}

/**
 * Text-selection gesture over a page's runs (in the current displayed frame).
 * Pointer-down snaps to the nearest run; dragging extends the selection as an
 * index range in content order, so it behaves like real text selection across
 * lines. Pointer-down away from any text clears the selection.
 */
export function useTextSelection(runs: TextRun[]) {
  const [range, setRange] = useState<SelectionRange | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const selectingRef = useRef(false)

  const hitTest = useCallback(
    (point: StrokePoint) => nearestRunIndex(runs, point),
    [runs],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary) return
      const hit = hitTest(pointOnSurface(event))
      if (hit === null) {
        setRange(null)
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      selectingRef.current = true
      setIsSelecting(true)
      setRange({ anchor: hit, focus: hit })
    },
    [hitTest],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!selectingRef.current) return
      const hit = hitTest(pointOnSurface(event))
      if (hit !== null) {
        setRange((previous) => (previous ? { anchor: previous.anchor, focus: hit } : previous))
      }
    },
    [hitTest],
  )

  const endSelection = useCallback(() => {
    selectingRef.current = false
    setIsSelecting(false)
  }, [])

  const clearSelection = useCallback(() => {
    setRange(null)
    setIsSelecting(false)
    selectingRef.current = false
  }, [])

  const selectedRuns = useMemo(() => {
    if (!range) return []
    const start = Math.min(range.anchor, range.focus)
    const end = Math.max(range.anchor, range.focus)
    return runs.slice(start, end + 1)
  }, [runs, range])

  return {
    selectedRuns,
    isSelecting,
    clearSelection,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endSelection,
      onPointerCancel: endSelection,
    },
  }
}

function pointOnSurface(event: PointerEvent<HTMLDivElement>): StrokePoint {
  const bounds = event.currentTarget.getBoundingClientRect()
  return normalizedPointInBounds(event.clientX, event.clientY, bounds)
}

/** Index of the run nearest to `point`, or null when none is within snapping range. */
function nearestRunIndex(runs: TextRun[], point: StrokePoint): number | null {
  let bestIndex: number | null = null
  let bestDistance = SNAP_DISTANCE
  for (let index = 0; index < runs.length; index += 1) {
    const distance = distanceToInflatedRect(runs[index].rect, point)
    if (distance <= bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function distanceToInflatedRect(rect: NormalizedRect, point: StrokePoint): number {
  const inflation = rect.height * VERTICAL_INFLATION
  const top = rect.y - inflation
  const bottom = rect.y + rect.height + inflation
  const dx = Math.max(rect.x - point.x, point.x - (rect.x + rect.width), 0)
  const dy = Math.max(top - point.y, point.y - bottom, 0)
  return Math.hypot(dx, dy)
}
