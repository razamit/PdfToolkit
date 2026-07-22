import { MoveDiagonal2, X } from 'lucide-react'
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
