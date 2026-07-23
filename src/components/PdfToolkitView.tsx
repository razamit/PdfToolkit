import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useFileUpload } from '@/hooks/useFileUpload'
import { AppHeader } from './AppHeader'
import { EmptyState } from './EmptyState'
import { SourceLegend } from './SourceLegend'
import { ThumbnailGrid } from './ThumbnailGrid'
import { SignatureModal } from './signature/SignatureModal'
import { TextAnnotateModal } from './text/TextAnnotateModal'
import { ImageAnnotateModal } from './image/ImageAnnotateModal'
import { HighlightAnnotateModal } from './highlight/HighlightAnnotateModal'
import { FreehandHighlightModal } from './freehand/FreehandHighlightModal'
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
    // 80vh, not min-h-screen: the static landing content below #root has to peek
    // above the fold or nobody discovers it. The value is paired with the
    // `#root { min-height: 80vh }` reservation in src/landing.css that stops the
    // page shifting on mount; changing one without the other brings the shift
    // back. See decision row 15.
    <div {...dropzoneProps} className="relative flex min-h-[80vh] flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {error && <ErrorBanner message={error} onDismiss={dismissError} />}
        {hasPages ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="lg:sticky lg:top-[calc(var(--app-header-height,112px)+1rem)] lg:w-56 lg:shrink-0">
              <SourceLegend />
            </aside>
            <div className="min-w-0 flex-1">
              <ThumbnailGrid />
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </main>

      {/* The site footer is deliberately NOT rendered here. It is static markup
          at the end of index.html, below the landing content, so that it sits
          after that content in document order and is readable without
          JavaScript. See `.site-footer` in src/landing.css. */}

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
      {annotatingPage && annotatingTool === 'freehand-highlight' && (
        <FreehandHighlightModal key={annotatingPage.id} />
      )}
      {annotatingPage && annotatingTool === 'arrange' && (
        <ArrangeMarksModal key={annotatingPage.id} />
      )}
    </div>
  )
}
