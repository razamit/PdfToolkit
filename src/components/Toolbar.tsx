import { useState } from 'react'
import { Download, FileUp, ImageUp, Trash2 } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from './ui/button'
import { FileInputButton } from './FileInputButton'
import { GridSizeControl } from './GridSizeControl'
import { PageSizeControl } from './PageSizeControl'

/** Primary action bar shown above the grid once pages are loaded. */
export function Toolbar() {
  const { addFiles, exportPdf, isBusy, pages } = usePdfToolkit()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FileInputButton accept="application/pdf" onFiles={addFiles} disabled={isBusy}>
        <FileUp />
        Add PDFs
      </FileInputButton>
      <FileInputButton accept="image/jpeg,image/png" onFiles={addFiles} disabled={isBusy}>
        <ImageUp />
        Add images
      </FileInputButton>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <GridSizeControl />
        <PageSizeControl />
        <ResetButton />
        <Button onClick={() => exportPdf('all')} disabled={isBusy || pages.length === 0}>
          <Download />
          Export PDF
        </Button>
      </div>
    </div>
  )
}

function ResetButton() {
  const { resetAll, pages } = usePdfToolkit()
  const [confirming, setConfirming] = useState(false)
  if (pages.length === 0) return null

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Remove everything?</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            resetAll()
            setConfirming(false)
          }}
        >
          Reset all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button variant="ghost" onClick={() => setConfirming(true)}>
      <Trash2 />
      Reset
    </Button>
  )
}
