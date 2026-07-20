import { useCallback, useMemo } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { PageThumbnail } from './PageThumbnail'
import { GRID_COLUMN_CLASS, THUMBNAIL_TARGET_PX } from '@/lib/gridSize'
import { cn } from '@/lib/utils'

export function ThumbnailGrid() {
  const { pages, gridColumns, selection, reorder, rotatePages, removePages, beginSign } =
    usePdfToolkit()

  const sensors = useSensors(
    // A small drag threshold lets clicks (select, rotate, delete) through cleanly.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => pages.map((page) => page.id), [pages])
  const targetWidthPx = THUMBNAIL_TARGET_PX[gridColumns]

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) reorder(String(active.id), String(over.id))
    },
    [reorder],
  )

  const handleSelect = useCallback(
    (id: string, withShift: boolean) =>
      withShift ? selection.selectRange(id) : selection.toggle(id),
    [selection.selectRange, selection.toggle],
  )

  const handleRotate = useCallback(
    (id: string, delta: number) => rotatePages([id], delta),
    [rotatePages],
  )

  const handleRemove = useCallback((id: string) => removePages([id]), [removePages])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={cn('grid gap-4', GRID_COLUMN_CLASS[gridColumns])}>
          {pages.map((page, index) => (
            <PageThumbnail
              key={page.id}
              page={page}
              index={index}
              targetWidthPx={targetWidthPx}
              isSelected={selection.isSelected(page.id)}
              onSelect={handleSelect}
              onRotate={handleRotate}
              onRemove={handleRemove}
              onSign={beginSign}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
