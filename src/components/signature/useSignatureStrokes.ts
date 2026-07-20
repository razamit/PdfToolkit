import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { drawStrokes } from '@/lib/strokeRendering'
import { normalizedPointInBounds } from '@/lib/signatureGeometry'
import type { SignatureStroke, StrokePoint } from '@/domain/types'

const MAX_CANVAS_DPR = 2

/**
 * Captures pointer strokes on a canvas in normalized [0,1] coordinates and
 * keeps the canvas painted: DPR-scaled backing store synced on resize, full
 * redraw whenever strokes change. Seed strokes pre-fill the surface.
 */
export function useSignatureStrokes(seedStrokes: SignatureStroke[]) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [strokes, setStrokes] = useState<SignatureStroke[]>(seedStrokes)
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const isDrawingRef = useRef(false)

  useEffect(() => {
    redrawCanvas(canvasRef.current, strokes)
  }, [strokes])

  // Callback ref: the canvas mounts only after its container is measured, so
  // the observer (and first paint) must attach whenever the element appears.
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      syncBackingStore(canvas)
      redrawCanvas(canvas, strokesRef.current)
    })
    observer.observe(canvas)
    observerRef.current = observer
    syncBackingStore(canvas)
    redrawCanvas(canvas, strokesRef.current)
  }, [])

  const onPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDrawingRef.current = true
    const point = pointOnCanvas(event)
    setStrokes((previous) => [...previous, [point]])
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const point = pointOnCanvas(event)
    setStrokes((previous) => appendToLastStroke(previous, point))
  }, [])

  const endStroke = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  const undo = useCallback(() => setStrokes((previous) => previous.slice(0, -1)), [])
  const clear = useCallback(() => setStrokes([]), [])

  return {
    canvasRef: attachCanvas,
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

function pointOnCanvas(event: PointerEvent<HTMLCanvasElement>): StrokePoint {
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

/** Match the canvas backing store to its CSS size at device resolution. */
function syncBackingStore(canvas: HTMLCanvasElement): void {
  const bounds = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR)
  const width = Math.max(1, Math.round(bounds.width * dpr))
  const height = Math.max(1, Math.round(bounds.height * dpr))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function redrawCanvas(canvas: HTMLCanvasElement | null, strokes: SignatureStroke[]): void {
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  drawStrokes(context, strokes, canvas.width, canvas.height)
}
