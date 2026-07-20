import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useFileUpload } from '@/hooks/useFileUpload'
import { AppHeader } from './AppHeader'
import { BulkActionBar } from './BulkActionBar'
import { EmptyState } from './EmptyState'
import { ThumbnailGrid } from './ThumbnailGrid'
import { SignatureModal } from './signature/SignatureModal'
import { BusyOverlay, DragOverlay, ErrorBanner } from './StatusOverlays'

/** Top-level layout: header, drop-anywhere upload, grid or empty state, overlays. */
export function PdfToolkitView() {
  const { pages, isBusy, busyLabel, error, addFiles, dismissError, signingPage } = usePdfToolkit()
  const { isDragging, dropzoneProps } = useFileUpload(addFiles)
  const hasPages = pages.length > 0

  return (
    <div {...dropzoneProps} className="relative flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {error && <ErrorBanner message={error} onDismiss={dismissError} />}
        {hasPages ? <ThumbnailGrid /> : <EmptyState />}
      </main>

      <footer className="border-t py-4">
        <p className="mx-auto max-w-[1400px] px-4 text-center text-xs text-muted-foreground sm:px-6">
          Processed entirely in your browser. JPEGs embed byte-for-byte; PDF pages keep their
          original content and resolution.
        </p>
      </footer>

      <BulkActionBar />
      {isDragging && <DragOverlay />}
      {isBusy && <BusyOverlay label={busyLabel} />}
      {signingPage && <SignatureModal key={signingPage.id} />}
    </div>
  )
}
