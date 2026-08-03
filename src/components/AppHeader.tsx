import { useState } from 'react'
import { MessageSquareText, ShieldCheck } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useCssHeightVariable } from '@/hooks/useCssHeightVariable'
import { BulkActionBar } from './BulkActionBar'
import { MachineMark } from './MachineMark'
import { Toolbar } from './Toolbar'
import { FeedbackDialog } from './feedback/FeedbackDialog'

/** Sticky app header: brand, privacy badge, page summary, and the toolbar. */
export function AppHeader() {
  const { pages } = usePdfToolkit()
  const hasPages = pages.length > 0
  const uploadedFileCount = new Set(
    pages.filter((page) => page.kind !== 'blank').map((page) => page.sourceId),
  ).size
  const blankPageCount = pages.filter((page) => page.kind === 'blank').length
  const documentSummary = [
    `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`,
    uploadedFileCount > 0
      ? `${uploadedFileCount} ${uploadedFileCount === 1 ? 'file' : 'files'}`
      : null,
    blankPageCount > 0
      ? `${blankPageCount} blank ${blankPageCount === 1 ? 'page' : 'pages'}`
      : null,
  ].filter(Boolean).join(' · ')
  const headerRef = useCssHeightVariable<HTMLElement>('--app-header-height')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur"
    >
      {/* Full width, matching `<main>` in PdfToolkitView — the toolbar has to
          sit over the grid it acts on, so a narrower header would leave the
          outermost thumbnails with no controls above them. */}
      <div className="mx-auto flex w-full flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MachineMark />
            <div>
              {/* A brand label, not the document heading. The page's single <h1>
                  is in the static landing content at the end of index.html, so
                  that it exists in the served HTML rather than only after
                  hydration; promoting this back to an <h1> would give the
                  rendered page two. */}
              <p className="text-base font-semibold leading-none tracking-tight">
                Free PDF Machine
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasPages
                  ? documentSummary
                  : 'Free PDF editor · nothing is uploaded'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Send feedback"
              title="Send feedback"
              onClick={() => setFeedbackOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageSquareText className="size-3.5" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
            <a
              href="https://rzailabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground md:inline"
            >
              Built by <span className="font-medium">RZAiLabs</span>
            </a>
            <span className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Private · stays on your device</span>
              <span className="sm:hidden">Private</span>
            </span>
          </div>
        </div>

        {hasPages && (
          <div className="border-t pt-3">
            <Toolbar />
          </div>
        )}

        <BulkActionBar />
      </div>
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </header>
  )
}
