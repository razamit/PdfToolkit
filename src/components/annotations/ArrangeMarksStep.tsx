import { Button } from '@/components/ui/button'
import { PreviewSurface } from './PreviewSurface'
import { ExistingMarksOverlay } from './ExistingMarksOverlay'
import type { PageDescriptor } from '@/domain/types'
import type { RenderedSize } from '@/hooks/usePagePreview'

interface ArrangeMarksStepProps {
  page: PageDescriptor
  /** Footer hint explaining the available gestures. */
  hint: string
  onDone: () => void
  /** Bubbles the preview's rendered size (used by the image modal to place the pick). */
  onRenderedSizeChange?: (size: RenderedSize | null) => void
}

/**
 * Modal body for rearranging what is already on a page: the large preview
 * with every placed mark movable, resizable, and removable. Edits apply to
 * the page immediately; Done just closes.
 */
export function ArrangeMarksStep({
  page,
  hint,
  onDone,
  onRenderedSizeChange,
}: ArrangeMarksStepProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <PreviewSurface page={page} onRenderedSizeChange={onRenderedSizeChange}>
        {() => <ExistingMarksOverlay page={page} />}
      </PreviewSurface>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <Button onClick={onDone}>Done</Button>
      </footer>
    </div>
  )
}
