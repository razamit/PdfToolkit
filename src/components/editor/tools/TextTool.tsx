import { useCallback, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { meetsMinimumSize } from '@/lib/signatureGeometry'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { Button } from '@/components/ui/button'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { useRectDrag } from '@/hooks/useRectDrag'
import { cn } from '@/lib/utils'
import type { NormalizedRect, PageDescriptor } from '@/domain/types'
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE_PT,
  TEXT_CLICK_BOX,
} from '@/lib/annotationStyles'
import { TextStyleControls } from '@/components/text/TextStyleControls'
import { TextEditLayer } from '@/components/text/TextEditLayer'
import { EditorPanel } from '../EditorPanel'

interface TextToolProps {
  page: PageDescriptor
  zoom: number
}

/**
 * Text tool. Click anywhere on the page to drop a box, which comes up focused
 * so typing starts immediately; drag instead to size the box by hand. Saving
 * commits the text and clears the box, so the next click starts another one
 * without leaving the session. The save control is the tick against the box
 * rather than a footer button — see `TextEditLayer`.
 */
export function TextTool({ page, zoom }: TextToolProps) {
  const { addAnnotation, closeEditor } = usePdfToolkit()
  const { rect, reset, surfaceProps } = useRectDrag(null, { clickRect: TEXT_CLICK_BOX })
  const [text, setText] = useState('')
  const [fontSizePt, setFontSizePt] = useState(DEFAULT_TEXT_FONT_SIZE_PT)
  const [colorHex, setColorHex] = useState(DEFAULT_TEXT_COLOR)
  const [strippedUnsupported, setStrippedUnsupported] = useState(false)
  /** The placed rect grown to fit the typed content, in the displayed frame. */
  const [contentRect, setContentRect] = useState<NormalizedRect | null>(null)

  const handleTextChange = useCallback((value: string) => {
    const sanitized = sanitizeAnnotationText(value)
    if (sanitized !== value) setStrippedUnsupported(true)
    setText(sanitized)
  }, [])

  const canSave = contentRect !== null && text.trim() !== ''

  const handleSave = () => {
    if (!contentRect || !canSave) return
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'text',
      text,
      rect: contentRect,
      fontSizePt,
      colorHex,
      rotationAtCreate: page.rotation,
    })
    // Stay armed: clear the pending box so the next click places another.
    setText('')
    setContentRect(null)
    reset()
  }

  return (
    <EditorPanel
      footer={
        <>
          <div className="flex flex-wrap items-center gap-4">
            <TextStyleControls
              fontSizePt={fontSizePt}
              colorHex={colorHex}
              onFontSizeChange={setFontSizePt}
              onColorChange={setColorHex}
            />
            <p
              className={cn(
                'text-xs text-muted-foreground',
                strippedUnsupported && 'text-destructive',
              )}
            >
              {strippedUnsupported
                ? 'Some characters aren’t supported by the PDF font and were removed.'
                : rect
                  ? 'Type, then press the ✓ next to the box to save it.'
                  : 'Click where the text should go, or drag to size the box.'}
            </p>
          </div>
          <Button variant="outline" onClick={closeEditor}>
            Close
          </Button>
        </>
      }
    >
      <PreviewSurface page={page} zoom={zoom}>
        {({ renderedSize, fittedSize }) => (
          <>
            <div {...surfaceProps} className="absolute inset-0 cursor-text touch-none" />
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
                canCommit={canSave}
                onCommit={handleSave}
              />
            )}
          </>
        )}
      </PreviewSurface>
    </EditorPanel>
  )
}
