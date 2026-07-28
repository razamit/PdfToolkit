import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from '@/components/ui/button'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { EditorPanel, EditorHint } from '../EditorPanel'
import type { PageDescriptor } from '@/domain/types'
import type { RenderedSize } from '@/hooks/usePagePreview'

interface IdleToolProps {
  page: PageDescriptor
  zoom: number
  onRenderedSizeChange?: (size: RenderedSize | null) => void
}

/**
 * The session's resting state: the page with nothing armed. No capture layer
 * is rendered over it, so every placed mark receives its own pointer events
 * and is directly draggable, resizable and removable — this is what used to
 * require opening a separate "Move & resize" dialog.
 */
export function IdleTool({ page, zoom, onRenderedSizeChange }: IdleToolProps) {
  const { closeEditor } = usePdfToolkit()
  const hasMarks = (page.signatures?.length ?? 0) + (page.annotations?.length ?? 0) > 0

  return (
    <EditorPanel
      footer={
        <>
          <EditorHint>
            {hasMarks
              ? 'Drag anything on the page to move it, or its corner handle to resize. Pick a tool above to add more.'
              : 'Pick a tool above to add text, a signature, an image or a highlight.'}
          </EditorHint>
          <Button variant="outline" onClick={closeEditor}>
            Close
          </Button>
        </>
      }
    >
      <PreviewSurface page={page} zoom={zoom} onRenderedSizeChange={onRenderedSizeChange}>
        {() => <ExistingMarksOverlay page={page} />}
      </PreviewSurface>
    </EditorPanel>
  )
}
