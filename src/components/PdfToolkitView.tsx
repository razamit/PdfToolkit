import { ChevronDown } from 'lucide-react'
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
    // Paired with the `#root { min-height: 100vh }` reservation in
    // src/landing.css, which is what stops the static landing content below
    // #root from painting at the top of the viewport and then being shoved down
    // on mount. Both must be the full viewport height and must change together:
    // an 80vh version was tried and measured, and it pulls the landing up into
    // the viewport where the app outgrowing its reservation becomes a visible
    // 136-509px shift. See decision rows 15 and 16.
    <div {...dropzoneProps} className="relative flex min-h-screen flex-col">
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

      {/* The landing section sits below the fold by design, so this link is the
          only thing that tells anyone it is there. The boot state in index.html
          renders the same row in the same position, so mounting does not move
          it. Styles are shared (`.about-link-row` in src/landing.css) rather
          than duplicated as utilities, so the two cannot drift apart. */}
      <div className="about-link-row">
        <a className="about-link" href="#about">
          How it works
          <ChevronDown aria-hidden />
        </a>
      </div>

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
