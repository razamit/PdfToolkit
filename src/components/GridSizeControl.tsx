import { ZoomIn, ZoomOut } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { GRID_OPTIONS } from '@/lib/gridSize'

/**
 * Thumbnail-size slider. Sliding right increases size (fewer columns per row);
 * sliding left decreases size (more columns per row).
 */
export function GridSizeControl() {
  const { gridColumns, setGridColumns } = usePdfToolkit()
  const currentIndex = GRID_OPTIONS.findIndex((option) => option.columns === gridColumns)

  return (
    <div className="flex items-center gap-2" title="Thumbnail size">
      <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="range"
        min={0}
        max={GRID_OPTIONS.length - 1}
        step={1}
        value={currentIndex < 0 ? 1 : currentIndex}
        onChange={(event) => setGridColumns(GRID_OPTIONS[Number(event.target.value)].columns)}
        aria-label="Thumbnail size"
        className="w-24 cursor-pointer accent-primary sm:w-28"
      />
      <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
    </div>
  )
}
