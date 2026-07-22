import { FileUp, ImageUp } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { FileInputButton } from './FileInputButton'
import { MachineMark } from './MachineMark'
import { UsageCounters } from './usage/UsageCounters'

/** Initial screen / drop target shown when no pages are loaded. */
export function EmptyState() {
  const { addFiles, isBusy } = usePdfToolkit()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 px-6 py-16 text-center">
      <MachineMark className="mb-5 size-14 rounded-2xl" />
      <h2 className="text-xl font-semibold tracking-tight">Feed PDFs or images into the machine</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Merge, reorder, rotate, sign, and annotate, then export a new PDF. Everything runs in your
        browser — your files never leave this device, and original quality is preserved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <FileInputButton
          accept="application/pdf"
          onFiles={addFiles}
          variant="default"
          disabled={isBusy}
        >
          <FileUp />
          Add PDFs
        </FileInputButton>
        <FileInputButton accept="image/jpeg,image/png" onFiles={addFiles} disabled={isBusy}>
          <ImageUp />
          Add images
        </FileInputButton>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Supports PDF, JPEG, and PNG</p>

      <UsageCounters />
    </div>
  )
}
