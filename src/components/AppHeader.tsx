import { ShieldCheck } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { useCssHeightVariable } from '@/hooks/useCssHeightVariable'
import { BulkActionBar } from './BulkActionBar'
import { MachineMark } from './MachineMark'
import { Toolbar } from './Toolbar'

/** Sticky app header: brand, privacy badge, page summary, and the toolbar. */
export function AppHeader() {
  const { pages } = usePdfToolkit()
  const hasPages = pages.length > 0
  const sourceCount = new Set(pages.map((page) => page.sourceId)).size
  const headerRef = useCssHeightVariable<HTMLElement>('--app-header-height')

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6">
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
                  ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · ${sourceCount} ${
                      sourceCount === 1 ? 'file' : 'files'
                    } loaded`
                  : 'Free PDF editor · nothing is uploaded'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
    </header>
  )
}
