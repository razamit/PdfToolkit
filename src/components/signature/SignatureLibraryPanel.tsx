import { cn } from '@/lib/utils'
import type { StoredSignature } from '@/domain/types'

interface SignatureLibraryPanelProps {
  /** Newest first. */
  signatures: StoredSignature[]
  /** Library entry currently loaded (and unmodified) on the canvas. */
  selectedId: string | null
  onSelect: (signature: StoredSignature) => void
}

/**
 * Strip of saved-signature thumbnails: a right-hand column on wider screens,
 * a horizontal row under the canvas on phones. Picking one loads it onto the
 * drawing canvas as a starting point.
 */
export function SignatureLibraryPanel({
  signatures,
  selectedId,
  onSelect,
}: SignatureLibraryPanelProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t bg-background p-2 sm:w-28 sm:flex-col sm:items-stretch sm:overflow-y-auto sm:overflow-x-hidden sm:border-l sm:border-t-0 sm:p-3">
      <p className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:block">
        Saved
      </p>
      {signatures.map((signature) => (
        <button
          key={signature.id}
          type="button"
          aria-label="Use saved signature"
          title="Use saved signature"
          aria-pressed={signature.id === selectedId}
          onClick={() => onSelect(signature)}
          className={cn(
            'h-12 w-20 shrink-0 rounded-lg border bg-white p-1 transition-colors hover:border-primary/60 sm:h-14 sm:w-auto',
            signature.id === selectedId ? 'border-primary ring-1 ring-primary' : 'border-input',
          )}
        >
          <img
            src={signature.pngDataUrl}
            alt=""
            draggable={false}
            className="size-full object-contain"
          />
        </button>
      ))}
    </div>
  )
}
