import { useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { evenPageIndices, oddPageIndices, parsePageRanges } from '@/lib/pageRanges'
import { Button } from '@/components/ui/button'
import { Modal, fieldClassName } from '@/components/ui/Modal'

export function SmartSplitDialog({ onClose }: { onClose: () => void }) {
  const { pages, selection, exportPageGroups } = usePdfToolkit()
  const [ranges, setRanges] = useState(`1-${pages.length}`)
  const [mode, setMode] = useState<'combined' | 'zip'>('combined')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    try {
      const parsed = parsePageRanges(ranges, pages.length)
      const groups = mode === 'combined' ? [parsed.combined] : parsed.groups
      await exportPageGroups(
        groups.map((group) => group.map((index) => pages[index].id)),
        mode,
      )
      onClose()
    } catch (rangeError) {
      setError(rangeError instanceof Error ? rangeError.message : 'That page range is invalid.')
    }
  }

  const setIndices = (indices: number[]) => setRanges(indices.map((index) => index + 1).join(', '))

  return (
    <Modal
      title="Split or extract pages"
      description="Use page numbers and ranges such as 1-4, 7, 10-end. Reverse ranges like 8-5 also work."
      onClose={onClose}
    >
      <label className="block text-sm font-medium">
        Pages
        <input
          className={`${fieldClassName} mt-1`}
          value={ranges}
          onChange={(event) => setRanges(event.target.value)}
          placeholder="1-4, 7, 10-end"
          autoFocus
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setRanges(`1-${pages.length}`)}>All</Button>
        <Button size="sm" variant="outline" onClick={() => setIndices(oddPageIndices(pages.length))}>Odd</Button>
        <Button size="sm" variant="outline" onClick={() => setIndices(evenPageIndices(pages.length))}>Even</Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selection.count === 0}
          onClick={() =>
            setIndices(
              pages.flatMap((page, index) => (selection.selectedIds.has(page.id) ? [index] : [])),
            )
          }
        >
          Selected
        </Button>
      </div>

      <fieldset className="mt-5 space-y-2">
        <legend className="text-sm font-medium">Output</legend>
        <label className="flex gap-2 rounded-lg border p-3 text-sm">
          <input type="radio" checked={mode === 'combined'} onChange={() => setMode('combined')} />
          <span><strong>One extracted PDF</strong><br /><span className="text-muted-foreground">All listed pages, in the order entered.</span></span>
        </label>
        <label className="flex gap-2 rounded-lg border p-3 text-sm">
          <input type="radio" checked={mode === 'zip'} onChange={() => setMode('zip')} />
          <span><strong>Separate PDFs in a ZIP</strong><br /><span className="text-muted-foreground">Each comma-separated item becomes one PDF.</span></span>
        </label>
      </fieldset>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <footer className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void submit()}>{mode === 'zip' ? 'Download ZIP' : 'Export PDF'}</Button>
      </footer>
    </Modal>
  )
}
