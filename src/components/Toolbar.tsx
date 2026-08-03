import { useState } from 'react'
import {
  Download,
  FileInput,
  FilePlus2,
  FileUp,
  ImageUp,
  Redo2,
  Scissors,
  ScanLine,
  Stamp,
  Trash2,
  Undo2,
} from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from './ui/button'
import { FileInputButton } from './FileInputButton'
import { GridSizeControl } from './GridSizeControl'
import { PageSizeControl } from './PageSizeControl'
import { SmartSplitDialog } from './tools/SmartSplitDialog'
import { DecorationsDialog } from './tools/DecorationsDialog'
import { CropDialog } from './tools/CropDialog'
import { FormFillingDialog } from './tools/FormFillingDialog'

/** Primary action bar shown above the grid once pages are loaded. */
export function Toolbar() {
  const {
    addFiles,
    addBlankPage,
    exportPdf,
    isBusy,
    pages,
    canUndo,
    canRedo,
    undo,
    redo,
    exportDecorations,
  } = usePdfToolkit()
  const [dialog, setDialog] = useState<'split' | 'stamps' | 'crop' | 'forms' | null>(null)
  const stampsEnabled = exportDecorations.pageNumbers.enabled || exportDecorations.watermark.enabled

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
      <Button variant="outline" onClick={addBlankPage} disabled={isBusy}>
        <FilePlus2 />
        Add blank
      </Button>

      <Button size="sm" variant="ghost" disabled={!canUndo || isBusy} onClick={undo} title="Undo (Ctrl/⌘ Z)">
        <Undo2 />
        <span className="hidden xl:inline">Undo</span>
      </Button>
      <Button size="sm" variant="ghost" disabled={!canRedo || isBusy} onClick={redo} title="Redo (Ctrl/⌘ Shift Z)">
        <Redo2 />
        <span className="hidden xl:inline">Redo</span>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setDialog('split')}>
        <Scissors />
        Split
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog('crop')}>
        <ScanLine />
        Crop
      </Button>
      <Button size="sm" variant={stampsEnabled ? 'secondary' : 'outline'} onClick={() => setDialog('stamps')}>
        <Stamp />
        Stamps{stampsEnabled ? ' on' : ''}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog('forms')}>
        <FileInput />
        Forms
      </Button>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <GridSizeControl />
        <PageSizeControl />
        <ResetButton />
        <Button onClick={() => exportPdf('all')} disabled={isBusy || pages.length === 0}>
          <Download />
          Export PDF
        </Button>
      </div>

      {dialog === 'split' && <SmartSplitDialog onClose={() => setDialog(null)} />}
      {dialog === 'crop' && <CropDialog onClose={() => setDialog(null)} />}
      {dialog === 'stamps' && <DecorationsDialog onClose={() => setDialog(null)} />}
      {dialog === 'forms' && <FormFillingDialog onClose={() => setDialog(null)} />}
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
