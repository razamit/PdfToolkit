import { AlertTriangle, Loader2, UploadCloud, X } from 'lucide-react'

/** Full-screen hint shown while files are being dragged over the window. */
export function DragOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/5 p-6 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background/90 px-10 py-8 text-center shadow-lg">
        <UploadCloud className="size-8 text-primary" />
        <p className="text-sm font-medium">Drop to add PDFs or images</p>
      </div>
    </div>
  )
}

/** Small non-blocking status pill shown while loading/exporting. */
export function BusyOverlay({ label }: { label: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-3.5 py-2 text-sm shadow-lg">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>{label ?? 'Working…'}</span>
      </div>
    </div>
  )
}

/** Dismissible error banner; messages may contain multiple lines. */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1 whitespace-pre-line">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="rounded-md p-0.5 transition-colors hover:bg-destructive/10"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
