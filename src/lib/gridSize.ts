import type { GridColumns } from '@/domain/types'

/** Size steps, smallest (most per row) to largest (fewest per row). */
export const GRID_OPTIONS: { columns: GridColumns; label: string }[] = [
  { columns: 6, label: 'XS' },
  { columns: 4, label: 'S' },
  { columns: 3, label: 'M' },
  { columns: 2, label: 'L' },
]

/** Thumbnail render width (CSS px, before DPR) per zoom level. */
export const THUMBNAIL_TARGET_PX: Record<GridColumns, number> = {
  6: 220,
  4: 320,
  3: 440,
  2: 640,
}

/** Responsive column classes — fewer columns on small screens at every level. */
export const GRID_COLUMN_CLASS: Record<GridColumns, string> = {
  6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  3: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3',
  2: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
}
