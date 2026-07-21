import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface AnnotationModalShellProps {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}

/**
 * Shared chrome for annotation dialogs: backdrop, dialog frame, header with a
 * close button, and Escape-to-close. Clicking the backdrop intentionally does
 * not close, so in-progress work can't be lost by a stray tap.
 */
export function AnnotationModalShell({
  title,
  subtitle,
  onClose,
  children,
}: AnnotationModalShellProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden overscroll-contain rounded-2xl border bg-background shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            autoFocus
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
