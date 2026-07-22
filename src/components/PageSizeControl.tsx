import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { PageSizeMode } from '@/domain/types'

const PAGE_SIZE_OPTIONS: Array<{ value: PageSizeMode; label: string }> = [
  { value: 'original', label: 'Original sizes' },
  { value: 'match', label: 'Match document' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
]

/**
 * Export page-size selector. Anything but "Original sizes" scales every page
 * (up or down, aspect preserved) to fit the chosen size in the output PDF, so
 * oversized images sit at the same visual scale as the rest of the document.
 */
export function PageSizeControl() {
  const { pageSizeMode, setPageSizeMode, isBusy } = usePdfToolkit()

  return (
    <label
      className="flex items-center gap-2 text-sm text-muted-foreground"
      title="Page size in the exported PDF"
    >
      <span className="hidden sm:inline">Page size</span>
      <select
        value={pageSizeMode}
        onChange={(event) => setPageSizeMode(event.target.value as PageSizeMode)}
        disabled={isBusy}
        aria-label="Page size in the exported PDF"
        className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
