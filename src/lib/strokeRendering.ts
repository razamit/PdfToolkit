import type {
  NormalizedRect,
  RememberedSignature,
  SignatureStroke,
  StrokePoint,
} from '@/domain/types'

const INK_COLOR = '#111827'
/** Long side of the offscreen render, so mobile-drawn signatures export crisp. */
const EXPORT_LONG_SIDE_PX = 1200
/** Line width as a fraction of the drawing surface's smaller dimension. */
const STROKE_WIDTH_FRACTION = 1 / 50
/** Fraction of the surface the pre-filled last signature occupies. */
const PREFILL_FILL_FRACTION = 0.8
const BBOX_PADDING_PX = 2

export interface StrokeRenderResult {
  /** Transparent PNG of the ink, cropped to its bounding box. */
  dataUrl: string
  /** Ink bounding box normalized to the drawing surface. */
  bbox: NormalizedRect
  /** Width / height of the cropped ink image. */
  inkAspectRatio: number
}

/** Colour + line width overrides for a stroke render (defaults: signature ink). */
export interface StrokeStyle {
  /** Stroke colour; defaults to the signature ink colour. */
  color?: string
  /** Explicit line width in surface pixels; defaults to `strokeLineWidth`. */
  lineWidth?: number
}

/**
 * A stroke reduced to its draw operations, shared by the canvas tracer and the
 * SVG path builder so screen and export curves are byte-for-byte identical:
 * a moveto to `start`, a run of midpoint quadratics, then a lineto to `end`.
 * A single-point stroke is a `dot` rendered as a round cap at `start`.
 */
export interface StrokePath {
  start: StrokePoint
  quads: Array<{ control: StrokePoint; end: StrokePoint }>
  /** Final straight segment endpoint, or null for a dot. */
  end: StrokePoint | null
  isDot: boolean
}

export function strokeLineWidth(width: number, height: number): number {
  return Math.max(1.5, Math.min(width, height) * STROKE_WIDTH_FRACTION)
}

/**
 * Midpoint-quadratic control sequence for one stroke, in whatever coordinate
 * space the points arrive in. Midpoints are linear, so pre- or post-scaling the
 * points yields the same curve — the canvas tracer and the SVG builder both
 * scale to their surface first, then call this. Returns null for an empty stroke.
 */
export function strokeControlPoints(points: StrokePoint[]): StrokePath | null {
  if (points.length === 0) return null
  if (points.length === 1) return { start: points[0], quads: [], end: null, isDot: true }
  const quads: StrokePath['quads'] = []
  for (let i = 1; i < points.length - 1; i += 1) {
    quads.push({
      control: points[i],
      end: { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 },
    })
  }
  return { start: points[0], quads, end: points[points.length - 1], isDot: false }
}

/** Paint normalized strokes onto a context of the given pixel size. */
export function drawStrokes(
  context: CanvasRenderingContext2D,
  strokes: SignatureStroke[],
  width: number,
  height: number,
  style?: StrokeStyle,
): void {
  const color = style?.color ?? INK_COLOR
  context.strokeStyle = color
  context.fillStyle = color
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = style?.lineWidth ?? strokeLineWidth(width, height)
  for (const stroke of strokes) traceStroke(context, stroke, width, height)
}

/** One stroke as a midpoint-smoothed quadratic path; a single point becomes a dot. */
function traceStroke(
  context: CanvasRenderingContext2D,
  stroke: SignatureStroke,
  width: number,
  height: number,
): void {
  const points = stroke.map((point) => ({ x: point.x * width, y: point.y * height }))
  const path = strokeControlPoints(points)
  if (!path) return
  if (path.isDot) {
    context.beginPath()
    context.arc(path.start.x, path.start.y, context.lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.beginPath()
  context.moveTo(path.start.x, path.start.y)
  for (const quad of path.quads) {
    context.quadraticCurveTo(quad.control.x, quad.control.y, quad.end.x, quad.end.y)
  }
  if (path.end) context.lineTo(path.end.x, path.end.y)
  context.stroke()
}

/**
 * Re-render strokes at high resolution and crop to the ink bounding box.
 * Returns null when there is no ink. `style` overrides colour and line width
 * (default: signature ink at `strokeLineWidth`).
 */
export function renderStrokesToPng(
  strokes: SignatureStroke[],
  surfaceAspectRatio: number,
  style?: StrokeStyle,
): StrokeRenderResult | null {
  const inked = strokes.filter((stroke) => stroke.length > 0)
  if (inked.length === 0) return null

  const { width, height } = exportSurfaceSize(surfaceAspectRatio)
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height
  const context = surface.getContext('2d')
  if (!context) return null
  const lineWidth = style?.lineWidth ?? strokeLineWidth(width, height)
  drawStrokes(context, inked, width, height, { color: style?.color, lineWidth })

  const bboxPx = inkBoundingBoxPx(inked, width, height, lineWidth)
  const cropped = cropCanvas(surface, bboxPx)
  return {
    dataUrl: cropped.toDataURL('image/png'),
    bbox: {
      x: bboxPx.x / width,
      y: bboxPx.y / height,
      width: bboxPx.width / width,
      height: bboxPx.height / height,
    },
    inkAspectRatio: bboxPx.width / bboxPx.height,
  }
}

/** Map strokes from surface coordinates into ink-bbox coordinates (the remembered form). */
export function normalizeStrokesToBbox(
  strokes: SignatureStroke[],
  bbox: NormalizedRect,
): SignatureStroke[] {
  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) =>
      stroke.map((point) => ({
        x: (point.x - bbox.x) / bbox.width,
        y: (point.y - bbox.y) / bbox.height,
      })),
    )
}

/** Scale a remembered signature into a drawing surface: contained, centered. */
export function fitStrokesIntoSurface(
  signature: RememberedSignature,
  surfaceAspectRatio: number,
): SignatureStroke[] {
  // Work in absolute units where the surface is (aspect × 1).
  const surfaceWidth = surfaceAspectRatio
  const surfaceHeight = 1
  const scale =
    Math.min(surfaceWidth / signature.aspectRatio, surfaceHeight) * PREFILL_FILL_FRACTION
  const inkWidth = signature.aspectRatio * scale
  const inkHeight = scale
  const originX = (surfaceWidth - inkWidth) / 2
  const originY = (surfaceHeight - inkHeight) / 2
  return signature.strokes.map((stroke) =>
    stroke.map((point) => ({
      x: (originX + point.x * inkWidth) / surfaceWidth,
      y: (originY + point.y * inkHeight) / surfaceHeight,
    })),
  )
}

/** Offscreen render size for a surface of the given aspect (long side fixed). */
export function exportSurfaceSize(aspectRatio: number): { width: number; height: number } {
  if (aspectRatio >= 1) {
    return {
      width: EXPORT_LONG_SIDE_PX,
      height: Math.max(1, Math.round(EXPORT_LONG_SIDE_PX / aspectRatio)),
    }
  }
  return {
    width: Math.max(1, Math.round(EXPORT_LONG_SIDE_PX * aspectRatio)),
    height: EXPORT_LONG_SIDE_PX,
  }
}

/** Ink bounds in surface pixels, padded for line width and clamped to the surface. */
function inkBoundingBoxPx(
  strokes: SignatureStroke[],
  width: number,
  height: number,
  lineWidth: number = strokeLineWidth(width, height),
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x * width)
      minY = Math.min(minY, point.y * height)
      maxX = Math.max(maxX, point.x * width)
      maxY = Math.max(maxY, point.y * height)
    }
  }
  const padding = lineWidth / 2 + BBOX_PADDING_PX
  const left = Math.max(0, Math.floor(minX - padding))
  const top = Math.max(0, Math.floor(minY - padding))
  const right = Math.min(width, Math.ceil(maxX + padding))
  const bottom = Math.min(height, Math.ceil(maxY + padding))
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

function cropCanvas(
  source: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const cropped = document.createElement('canvas')
  cropped.width = box.width
  cropped.height = box.height
  cropped
    .getContext('2d')
    ?.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
  return cropped
}
