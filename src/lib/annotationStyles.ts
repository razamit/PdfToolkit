/** Style palettes for annotation tools, kept out of component files for fast refresh. */

export const TEXT_FONT_SIZES_PT = [8, 10, 12, 14, 18, 24, 36]
export const TEXT_COLORS = ['#111827', '#DC2626', '#2563EB', '#16A34A']
export const DEFAULT_TEXT_FONT_SIZE_PT = 14
export const DEFAULT_TEXT_COLOR = TEXT_COLORS[0]

export const HIGHLIGHT_COLORS = ['#FFEB3B', '#B9F6CA', '#F8BBD0', '#B3E5FC']
export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0]

/** One free-hand highlighter thickness option. */
export interface HighlightThickness {
  label: string
  /** Line width as a fraction of the smaller displayed page dimension
   *  (rotation-invariant). ≈7 / 12 / 18pt on A4's 595pt short side. */
  fraction: number
}

export const HIGHLIGHT_THICKNESSES: HighlightThickness[] = [
  { label: 'S', fraction: 0.012 },
  { label: 'M', fraction: 0.02 },
  { label: 'L', fraction: 0.03 },
]

export const DEFAULT_HIGHLIGHT_THICKNESS = HIGHLIGHT_THICKNESSES[1].fraction
