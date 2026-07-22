import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { AnnotationModalShell } from './AnnotationModalShell'
import { ArrangeMarksStep } from './ArrangeMarksStep'

/** Standalone "Move & resize" dialog for rearranging a page's placed marks. */
export function ArrangeMarksModal() {
  const { annotatingPage, cancelAnnotate } = usePdfToolkit()
  if (!annotatingPage) return null

  return (
    <AnnotationModalShell
      title="Move & resize"
      subtitle="Adjust anything already placed on this page."
      onClose={cancelAnnotate}
    >
      <ArrangeMarksStep
        page={annotatingPage}
        hint="Drag an item to move it; drag its corner handle to resize. Changes apply immediately."
        onDone={cancelAnnotate}
      />
    </AnnotationModalShell>
  )
}
