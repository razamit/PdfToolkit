import { useCallback, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { meetsMinimumSize } from '@/lib/signatureGeometry'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { Button } from '@/components/ui/button'
import { AnnotationModalShell } from '@/components/annotations/AnnotationModalShell'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { useRectDrag } from '@/components/signature/useRectDrag'
import { cn } from '@/lib/utils'
import type { NormalizedRect } from '@/domain/types'
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT_SIZE_PT } from '@/lib/annotationStyles'
import { TextStyleControls } from './TextStyleControls'
import { TextEditLayer } from './TextEditLayer'

/**
 * Single-step text annotation dialog: drag a box on the page, type into it
 * in place (WYSIWYG — same font stack, size, and line height the export
 * uses), then add. Lines break on explicit newlines only.
 */
export function TextAnnotateModal() {
  const { annotatingPage, cancelAnnotate, addAnnotation } = usePdfToolkit()
  const { rect, surfaceProps } = useRectDrag(null)
  const [text, setText] = useState('')
  const [fontSizePt, setFontSizePt] = useState(DEFAULT_TEXT_FONT_SIZE_PT)
  const [colorHex, setColorHex] = useState(DEFAULT_TEXT_COLOR)
  const [strippedUnsupported, setStrippedUnsupported] = useState(false)
  /** The drawn rect grown to fit the typed content, in the displayed frame. */
  const [contentRect, setContentRect] = useState<NormalizedRect | null>(null)

  const handleTextChange = useCallback((value: string) => {
    const sanitized = sanitizeAnnotationText(value)
    if (sanitized !== value) setStrippedUnsupported(true)
    setText(sanitized)
  }, [])

  if (!annotatingPage) return null
  const page = annotatingPage
  const canSave = contentRect !== null && text.trim() !== ''

  const handleSave = () => {
    if (!contentRect) return
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'text',
      text,
      rect: contentRect,
      fontSizePt,
      colorHex,
      rotationAtCreate: page.rotation,
    })
    cancelAnnotate()
  }

  return (
    <AnnotationModalShell
      title="Add text"
      subtitle="Drag a box on the page, then type your text."
      onClose={cancelAnnotate}
    >
      <div className="flex min-h-0 flex-col">
        <PreviewSurface page={page}>
          {({ renderedSize, fittedSize }) => (
            <>
              <div {...surfaceProps} className="absolute inset-0 cursor-crosshair touch-none" />
              <ExistingMarksOverlay page={page} />
              {rect && meetsMinimumSize(rect, renderedSize) && (
                <TextEditLayer
                  rect={rect}
                  fittedSize={fittedSize}
                  renderedSize={renderedSize}
                  pageSize={{ width: page.width, height: page.height }}
                  text={text}
                  fontSizePt={fontSizePt}
                  colorHex={colorHex}
                  onTextChange={handleTextChange}
                  onContentRectChange={setContentRect}
                />
              )}
            </>
          )}
        </PreviewSurface>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <TextStyleControls
              fontSizePt={fontSizePt}
              colorHex={colorHex}
              onFontSizeChange={setFontSizePt}
              onColorChange={setColorHex}
            />
            <p className={cn('text-xs text-muted-foreground', strippedUnsupported && 'text-destructive')}>
              {strippedUnsupported
                ? 'Some characters aren’t supported by the PDF font and were removed.'
                : rect
                  ? 'Type into the box — drag elsewhere to move it.'
                  : 'Drag a box where the text should go.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelAnnotate}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={handleSave}>
              Add text
            </Button>
          </div>
        </footer>
      </div>
    </AnnotationModalShell>
  )
}
