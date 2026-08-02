import { MoveDiagonal2, Pencil, X } from 'lucide-react'
import type { MarkHandleProps } from '@/hooks/useMarkTransform'

/**
 * Small controls shared by every placed mark (signatures and annotations):
 * the corner remove button and the corner resize handle. Both re-enable
 * pointer events inside overlays that are otherwise `pointer-events-none`.
 */

export function RemoveMarkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className="pointer-events-auto absolute -right-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full border bg-background text-destructive shadow-sm transition-colors hover:bg-destructive/10"
    >
      <X className="size-3" />
    </button>
  )
}

/** Corner button opening a text mark's content for re-editing. */
export function EditMarkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className="pointer-events-auto absolute -left-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full border bg-background text-primary shadow-sm transition-colors hover:bg-accent"
    >
      <Pencil className="size-3" />
    </button>
  )
}

/**
 * Outline drawn around the mark picked out in the items list, so selecting a
 * row says *which* mark it is. Sized just outside the mark's own box, and
 * rendered as a sibling of the mark's content rather than around it, so a
 * highlight's `mix-blend-multiply` never bleeds into the outline.
 */
export function MarkSelectionRing() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-1 rounded-sm border-2 border-primary"
    />
  )
}

/** Bottom-right drag handle wired to `useMarkTransform`'s resize handlers. */
export function ResizeMarkHandle({ handleProps }: { handleProps: MarkHandleProps }) {
  return (
    <div
      {...handleProps}
      aria-hidden
      className="pointer-events-auto absolute -bottom-2.5 -right-2.5 flex size-5 cursor-nwse-resize touch-none items-center justify-center rounded-full border bg-background text-primary shadow-sm"
    >
      <MoveDiagonal2 className="size-3" />
    </div>
  )
}
