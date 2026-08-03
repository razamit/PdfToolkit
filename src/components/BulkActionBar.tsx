import { CheckCheck, FileDown, RotateCcw, RotateCw, ScanText, Trash2, X } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from './ui/button'
import { ResizeMenu } from './ResizeMenu'

/** Bulk actions for the current multi-select, shown as a row in the sticky header. */
export function BulkActionBar() {
  const { selection, rotatePages, removePages, exportPdf, ocrPages, isBusy, pages } = usePdfToolkit()
  if (pages.length === 0) return null

  const ids = Array.from(selection.selectedIds)
  const hasSelection = selection.count > 0
  const allSelected = selection.count === pages.length

  return (
    <div className="border-t pt-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
        <span className="min-w-24 px-1 text-sm font-medium">
          {hasSelection ? `${selection.count} selected` : 'Nothing selected'}
        </span>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button size="sm" variant="outline" disabled={!hasSelection} onClick={() => rotatePages(ids, -90)}>
          <RotateCcw />
          <span>Rotate left</span>
        </Button>
        <Button size="sm" variant="outline" disabled={!hasSelection} onClick={() => rotatePages(ids, 90)}>
          <RotateCw />
          <span>Rotate right</span>
        </Button>
        <ResizeMenu pageIds={ids} disabled={!hasSelection} />
        <Button size="sm" variant="outline" disabled={!hasSelection || isBusy} onClick={() => void ocrPages(ids)}>
          <ScanText />
          <span>OCR locally</span>
        </Button>
        <Button size="sm" variant="outline" disabled={!hasSelection || isBusy} onClick={() => exportPdf('selected')}>
          <FileDown />
          <span>Export selected</span>
        </Button>
        <Button size="sm" variant="destructive" disabled={!hasSelection} onClick={() => removePages(ids)}>
          <Trash2 />
          <span>Delete</span>
        </Button>
        <span className="mx-1 ml-auto hidden h-5 w-px bg-border sm:block" />
        {!allSelected && (
          <Button size="sm" variant="ghost" onClick={selection.selectAll}>
            <CheckCheck />
            <span>Select all</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!hasSelection} onClick={selection.clear}>
          <X />
          <span>Clear</span>
        </Button>
      </div>
    </div>
  )
}
