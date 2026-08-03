import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { cn } from '@/lib/utils'

interface SourceSummary {
  sourceId: string
  name: string
  color: string | undefined
  pageIds: string[]
}

/**
 * Side list of the uploaded files, one row each with its origin color, name and
 * page count. A row selects all of that file's pages (toggles off when they are
 * already the whole selection); its trash button removes the file's pages.
 */
export function SourceLegend() {
  const { pages, getSourceName, getSourceColor, selection, removeSource } = usePdfToolkit()

  const sources = useMemo<SourceSummary[]>(() => {
    const byId = new Map<string, SourceSummary>()
    for (const page of pages) {
      let entry = byId.get(page.sourceId)
      if (!entry) {
        entry = {
          sourceId: page.sourceId,
          name: getSourceName(page.sourceId) ?? 'Untitled',
          color: getSourceColor(page.sourceId),
          pageIds: [],
        }
        byId.set(page.sourceId, entry)
      }
      entry.pageIds.push(page.id)
    }
    return [...byId.values()]
  }, [pages, getSourceName, getSourceColor])

  if (sources.length === 0) return null

  return (
    <section className="rounded-xl border bg-card p-3">
      <h2 className="px-1 pb-2 text-xs font-medium text-muted-foreground">Sources</h2>
      <ul className="space-y-0.5">
        {sources.map((source) => (
          <SourceRow
            key={source.sourceId}
            source={source}
            isActive={
              source.pageIds.length === selection.count &&
              source.pageIds.every((id) => selection.isSelected(id))
            }
            onSelect={() =>
              source.pageIds.every((id) => selection.isSelected(id)) &&
              source.pageIds.length === selection.count
                ? selection.clear()
                : selection.setSelection(source.pageIds)
            }
            onRemove={() => removeSource(source.sourceId)}
          />
        ))}
      </ul>
    </section>
  )
}

function SourceRow({
  source,
  isActive,
  onSelect,
  onRemove,
}: {
  source: SourceSummary
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const pageCount = source.pageIds.length
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        title={source.name}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
          isActive ? 'bg-accent' : 'hover:bg-accent',
        )}
      >
        <span
          className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5"
          style={{ backgroundColor: source.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{source.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${source.name}`}
        title="Remove file"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  )
}
