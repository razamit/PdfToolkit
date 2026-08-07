import { FilePlus2, FileUp } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { ACCEPT_ALL } from '@/lib/fileAccept'
import { FileInputButton } from './FileInputButton'
import { MachineMark } from './MachineMark'
import { SupportedFormats } from './SupportedFormats'
import { UsageCounters } from './usage/UsageCounters'
import { Button } from './ui/button'

/**
 * Initial screen / drop target shown when no pages are loaded.
 *
 * Two actions only — bring files in, or begin with a blank page. Which kind of
 * file it is has never been a decision the user needed to make, so the formats
 * are stated underneath instead of being split across buttons.
 */
export function EmptyState() {
  const { addFiles, addBlankPage, isBusy } = usePdfToolkit()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 px-6 py-16 text-center">
      <MachineMark className="mb-5 size-14 rounded-2xl" />
      <h2 className="text-xl font-semibold tracking-tight">Feed your files into the machine</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Merge, reorder, rotate, sign, and annotate, then export a new PDF. Everything runs in your
        browser — your files never leave this device, and original quality is preserved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <FileInputButton accept={ACCEPT_ALL} onFiles={addFiles} variant="default" disabled={isBusy}>
          <FileUp />
          Add files
        </FileInputButton>
        <Button variant="outline" onClick={addBlankPage} disabled={isBusy}>
          <FilePlus2 />
          Start blank
        </Button>
      </div>
      <SupportedFormats className="mt-6 max-w-lg" />

      <UsageCounters />
    </div>
  )
}
