import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { rectToCssPercent, rotateRect } from '@/lib/signatureGeometry'
import { mergeRunsIntoLines } from '@/lib/textRunGeometry'
import { Button } from '@/components/ui/button'
import { AnnotationModalShell } from '@/components/annotations/AnnotationModalShell'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { ColorSwatches } from '@/components/annotations/ColorSwatches'
import { cn } from '@/lib/utils'
import type { PageDescriptor } from '@/domain/types'
import { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS } from '@/lib/annotationStyles'
import { useTextRuns } from './useTextRuns'
import { useTextSelection } from './useTextSelection'

/**
 * Text-aware highlight dialog: drag across the page's text and the selection
 * snaps to the underlying runs, merged into one bar per line. Several
 * highlights can be added before closing with Done.
 */
export function HighlightAnnotateModal() {
  const { annotatingPage } = usePdfToolkit()
  if (!annotatingPage) return null
  return <HighlightModalContent page={annotatingPage} />
}

function HighlightModalContent({ page }: { page: PageDescriptor }) {
  const { cancelAnnotate, addAnnotation } = usePdfToolkit()
  const { runs, loading, failed } = useTextRuns(page)
  const [colorHex, setColorHex] = useState(DEFAULT_HIGHLIGHT_COLOR)

  // Runs are extracted in the base frame; rotate them into the current one.
  const displayedRuns = useMemo(
    () => (runs ?? []).map((run) => ({ ...run, rect: rotateRect(run.rect, page.rotation) })),
    [runs, page.rotation],
  )
  const { selectedRuns, isSelecting, clearSelection, surfaceProps } =
    useTextSelection(displayedRuns)

  const pendingLineRects = useMemo(
    () => (selectedRuns.length > 0 ? mergeRunsIntoLines(selectedRuns.map((run) => run.rect)) : []),
    [selectedRuns],
  )

  const noText = !loading && !failed && displayedRuns.length === 0

  const handleAdd = () => {
    if (pendingLineRects.length === 0) return
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'highlight',
      lineRects: pendingLineRects,
      colorHex,
      rotationAtCreate: page.rotation,
    })
    clearSelection()
  }

  return (
    <AnnotationModalShell
      title="Highlight text"
      subtitle="Drag across text to select it — the highlight snaps to the words."
      onClose={cancelAnnotate}
    >
      <div className="flex min-h-0 flex-col">
        <PreviewSurface page={page}>
          {() => (
            <>
              {/* Layering relies on DOM order (positioned siblings, no z-index): a
                  z-index would give the overlay its own stacking context and break
                  the highlights' mix-blend-multiply against the page canvas. */}
              <div
                {...surfaceProps}
                className={cn('absolute inset-0 touch-none', !noText && 'cursor-text')}
              />
              <ExistingMarksOverlay page={page} />
              <SelectionPreview
                rects={isSelecting ? selectedRuns.map((run) => run.rect) : pendingLineRects}
                colorHex={colorHex}
              />
              {loading && (
                <Loader2 className="absolute left-1/2 top-1/2 z-30 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {noText && (
                <p className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 rounded-md border bg-background/95 p-3 text-center text-xs text-muted-foreground">
                  No selectable text on this page — it may be a scan.
                </p>
              )}
            </>
          )}
        </PreviewSurface>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex items-center gap-4">
            <ColorSwatches
              colors={HIGHLIGHT_COLORS}
              colorHex={colorHex}
              onChange={setColorHex}
            />
            <p className="text-xs text-muted-foreground">
              {pendingLineRects.length > 0
                ? 'Selection ready — add it, or drag again to change.'
                : 'Drag across the text you want to highlight.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelAnnotate}>
              Done
            </Button>
            <Button disabled={pendingLineRects.length === 0} onClick={handleAdd}>
              Add highlight
            </Button>
          </div>
        </footer>
      </div>
    </AnnotationModalShell>
  )
}

function SelectionPreview({
  rects,
  colorHex,
}: {
  rects: { x: number; y: number; width: number; height: number }[]
  colorHex: string
}) {
  return (
    <>
      {rects.map((rect, index) => (
        <div
          key={index}
          className="pointer-events-none absolute mix-blend-multiply"
          style={{ ...rectToCssPercent(rect), backgroundColor: colorHex }}
        />
      ))}
    </>
  )
}
