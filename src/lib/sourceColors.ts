/**
 * Categorical colors used to identify which uploaded file a page came from —
 * one color per source, shown as the legend dot and the page-thumbnail border.
 *
 * This is a deliberate, meaning-carrying exception to the app's single-indigo
 * accent: the colors encode origin, so they must be distinguishable from each
 * other. They are muted (~Tailwind-600) so they read on white without shouting,
 * and none is the exact `--primary` indigo (selection uses that as a ring).
 */
export const SOURCE_COLORS = [
  '#2563EB', // blue
  '#DC2626', // red
  '#16A34A', // green
  '#D97706', // amber
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#DB2777', // pink
  '#65A30D', // lime
  '#EA580C', // orange
  '#4B5563', // slate
]
