import { useMemo } from 'react'
import { strokeControlPoints } from '@/lib/strokeRendering'
import type { SignatureStroke } from '@/domain/types'

interface HighlightInkSvgProps {
  /** Strokes normalized to the surface's displayed frame. */
  strokes: SignatureStroke[]
  /** Ink colour as #rrggbb; blended with Multiply against the page. */
  colorHex: string
  /** Line thickness as a fraction of the smaller surface dimension. */
  thickness: number
  /** On-screen size of the page box the strokes are normalized to, in px. */
  surface: { width: number; height: number }
}

/**
 * One `<svg>` of round-capped, round-joined highlighter paths in a single
 * `mix-blend-multiply` layer, so the whole shape multiplies over the page
 * exactly once — matching the flat single-multiply raster used at export, and
 * so self-overlaps don't darken. Carries no z-index on purpose: a stacking
 * context would break the blend against the page canvas (the same rule
 * `ExistingMarksOverlay` documents). Path curves come from the shared
 * `strokeControlPoints`, so they are identical to the exported PNG.
 */
export function HighlightInkSvg({ strokes, colorHex, thickness, surface }: HighlightInkSvgProps) {
  const { width, height } = surface
  const thicknessPx = thickness * Math.min(width, height)
  const paths = useMemo(
    () =>
      strokes
        .map((stroke) => strokeToSvgPath(stroke, width, height))
        .filter((path): path is string => path !== null),
    [strokes, width, height],
  )

  return (
    <svg
      className="pointer-events-none absolute inset-0 mix-blend-multiply"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {paths.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          stroke={colorHex}
          strokeWidth={thicknessPx}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

/** SVG `d` for one stroke, scaled to the surface; a dot is a zero-length segment. */
function strokeToSvgPath(stroke: SignatureStroke, width: number, height: number): string | null {
  const points = stroke.map((point) => ({ x: point.x * width, y: point.y * height }))
  const path = strokeControlPoints(points)
  if (!path) return null
  // A zero-length segment with round linecap renders as a dot (a filled circle
  // of diameter = strokeWidth), matching the canvas arc used at export.
  if (path.isDot) return `M ${path.start.x} ${path.start.y} L ${path.start.x} ${path.start.y}`
  let d = `M ${path.start.x} ${path.start.y}`
  for (const quad of path.quads) {
    d += ` Q ${quad.control.x} ${quad.control.y} ${quad.end.x} ${quad.end.y}`
  }
  if (path.end) d += ` L ${path.end.x} ${path.end.y}`
  return d
}
