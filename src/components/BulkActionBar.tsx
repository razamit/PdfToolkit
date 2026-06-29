import { CheckCheck, FileDown, RotateCcw, RotateCw, Trash2, X } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from './ui/button'

/** Floating bar with bulk actions for the current multi-select. */
export function BulkActionBar() {
  const { selection, rotatePages, removePages, exportPdf, pages } = usePdfToolkit()
  if (selection.count === 0) return null

  const ids = Array.from(selection.selectedIds)
  const allSelected = selection.count === pages.length

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="px-1 text-sm font-medium">{selection.count} selected</span>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button size="sm" variant="outline" onClick={() => rotatePages(ids, -90)}>
          <RotateCcw />
          <span className="hidden sm:inline">Rotate left</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => rotatePages(ids, 90)}>
          <RotateCw />
          <span className="hidden sm:inline">Rotate right</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportPdf('selected')}>
          <FileDown />
          <span className="hidden sm:inline">Export selected</span>
        </Button>
        <Button size="sm" variant="destructive" onClick={() => removePages(ids)}>
          <Trash2 />
          <span className="hidden sm:inline">Delete</span>
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {!allSelected && (
          <Button size="sm" variant="ghost" onClick={selection.selectAll}>
            <CheckCheck />
            <span className="hidden sm:inline">Select all</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={selection.clear}>
          <X />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  )
}
