import {
  Baseline,
  Highlighter,
  ImagePlus,
  PenLine,
  Trash2,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useMarkSelection } from '@/components/annotations/markSelectionContext'
import { cn } from '@/lib/utils'
import type { PageDescriptor } from '@/domain/types'
import { describePageMarks, markKindLabel, type PageMark, type PageMarkKind } from './pageMarks'

const KIND_ICONS: Record<PageMarkKind, LucideIcon> = {
  signature: PenLine,
  text: Type,
  image: ImagePlus,
  highlight: Baseline,
  'freehand-highlight': Highlighter,
}

/**
 * The editing session's items list: everything already on the page, down the
 * left of the dialog. Selecting a row rings its mark on the page and scrolls
 * to it; the row's bin removes it outright.
 *
 * It exists because the page itself is a poor index of its own contents — a
 * small text box or a highlight behind a signature is easy to lose track of,
 * and until now the only way to remove one was to find it and hit its corner
 * button.
 */
export function MarksListPanel({ page, className }: { page: PageDescriptor; className?: string }) {
  const { removeSignature, removeAnnotation } = usePdfToolkit()
  const { selectedMarkId, selectMark } = useMarkSelection()
  const marks = describePageMarks(page)

  const remove = (mark: PageMark) => {
    if (mark.source === 'signature') removeSignature(page.id, mark.id)
    else removeAnnotation(page.id, mark.id)
  }

  return (
    <aside
      aria-label="Items on this page"
      className={cn('flex min-h-0 w-56 shrink-0 flex-col border-r bg-background', className)}
    >
      <div className="flex items-baseline justify-between gap-2 border-b px-3 py-2">
        <h3 className="text-xs font-semibold">On this page</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{marks.length}</span>
      </div>

      {marks.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          Nothing added yet. Anything you add shows up here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {marks.map((mark) => (
            <MarkRow
              key={mark.id}
              mark={mark}
              selected={mark.id === selectedMarkId}
              onSelect={() => selectMark(mark.id)}
              onRemove={() => remove(mark)}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}

function MarkRow({
  mark,
  selected,
  onSelect,
  onRemove,
}: {
  mark: PageMark
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const Icon = KIND_ICONS[mark.kind]
  const kindLabel = markKindLabel(mark.kind)

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors',
          selected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-accent',
        )}
      >
        <button
          type="button"
          aria-current={selected}
          // The title *is* the kind's name for everything but text, so naming
          // both would announce "Highlight: Highlight".
          aria-label={mark.title === kindLabel ? kindLabel : `${kindLabel}: ${mark.title}`}
          title={mark.title}
          onClick={onSelect}
          // Delete on the focused row, so the list is usable from the keyboard
          // without tabbing on to its bin button.
          onKeyDown={(event) => {
            if (event.key !== 'Delete' && event.key !== 'Backspace') return
            event.preventDefault()
            onRemove()
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left"
        >
          <Icon
            aria-hidden
            className="size-3.5 shrink-0"
            style={{ color: mark.colorHex ?? undefined }}
          />
          <span className="min-w-0 flex-1 truncate text-xs">{mark.title}</span>
        </button>
        <button
          type="button"
          aria-label={`Delete ${kindLabel.toLowerCase()}`}
          title={`Delete ${kindLabel.toLowerCase()}`}
          onClick={onRemove}
          // Always visible, not hover-revealed: on a touch screen there is no
          // hover, and removal is half of what this list is for.
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  )
}
