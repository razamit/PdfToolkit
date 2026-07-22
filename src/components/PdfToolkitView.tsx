import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useFileUpload } from '@/hooks/useFileUpload'
import { AppHeader } from './AppHeader'
import { BulkActionBar } from './BulkActionBar'
import { EmptyState } from './EmptyState'
import { ThumbnailGrid } from './ThumbnailGrid'
import { SignatureModal } from './signature/SignatureModal'
import { TextAnnotateModal } from './text/TextAnnotateModal'
import { ImageAnnotateModal } from './image/ImageAnnotateModal'
import { HighlightAnnotateModal } from './highlight/HighlightAnnotateModal'
import { ArrangeMarksModal } from './annotations/ArrangeMarksModal'
import { BusyOverlay, DragOverlay, ErrorBanner } from './StatusOverlays'

/** Top-level layout: header, drop-anywhere upload, grid or empty state, overlays. */
export function PdfToolkitView() {
  const {
    pages,
    isBusy,
    busyLabel,
    error,
    addFiles,
    dismissError,
    signingPage,
    annotatingPage,
    annotatingTool,
  } = usePdfToolkit()
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
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-1.5 px-4 text-center text-xs text-muted-foreground sm:px-6">
          <p>
            <span className="font-medium text-foreground">Free PDF Machine</span> — processed
            entirely in your browser. JPEGs embed byte-for-byte; PDF pages keep their original
            content and resolution.
          </p>
          <p>
            Built by{' '}
            <a
              href="https://rzailabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              RZAiLabs
            </a>
          </p>
        </div>
      </footer>

      <BulkActionBar />
      {isDragging && <DragOverlay />}
      {isBusy && <BusyOverlay label={busyLabel} />}
      {signingPage && <SignatureModal key={signingPage.id} />}
      {annotatingPage && annotatingTool === 'text' && <TextAnnotateModal key={annotatingPage.id} />}
      {annotatingPage && annotatingTool === 'image' && (
        <ImageAnnotateModal key={annotatingPage.id} />
      )}
      {annotatingPage && annotatingTool === 'highlight' && (
        <HighlightAnnotateModal key={annotatingPage.id} />
      )}
      {annotatingPage && annotatingTool === 'arrange' && (
        <ArrangeMarksModal key={annotatingPage.id} />
      )}
    </div>
  )
}
