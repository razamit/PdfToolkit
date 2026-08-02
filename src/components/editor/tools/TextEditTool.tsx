import { useCallback, useMemo, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { normalizeRotation } from '@/managers/PageListManager'
import { rotateRect } from '@/lib/signatureGeometry'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { Button } from '@/components/ui/button'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { cn } from '@/lib/utils'
import type { NormalizedRect, PageDescriptor, TextPlacement } from '@/domain/types'
import { TEXT_CLICK_BOX } from '@/lib/annotationStyles'
import { TextStyleControls } from '@/components/text/TextStyleControls'
import { TextEditLayer } from '@/components/text/TextEditLayer'
import { EditorPanel } from '../EditorPanel'

interface TextEditToolProps {
  page: PageDescriptor
  zoom: number
  /** The placed text mark being re-edited. */
  mark: TextPlacement
  /** Called when the edit is saved or cancelled; the session stays open. */
  onDone: () => void
}

/**
 * Re-edit a placed text mark in place: the mark is hidden from the page and
 * its content comes up in the same grow-to-fit editor used to create it, at
 * the same spot. Saving rewrites the mark; cancelling leaves it untouched.
 *
 * The edit happens in the current display frame: if the page was rotated
 * since the text was created, saving re-bases the mark to today's rotation,
 * so the text reads upright in the frame it was just edited in.
 */
export function TextEditTool({ page, zoom, mark, onDone }: TextEditToolProps) {
  const { updateTextAnnotation } = usePdfToolkit()
  const [text, setText] = useState(mark.text)
  const [fontSizePt, setFontSizePt] = useState(mark.fontSizePt)
  const [colorHex, setColorHex] = useState(mark.colorHex)
  const [strippedUnsupported, setStrippedUnsupported] = useState(false)
  /** The mark's box grown to fit the edited content, in the displayed frame. */
  const [contentRect, setContentRect] = useState<NormalizedRect | null>(null)

  // The mark's box in today's display frame, shrunk to the default minimum so
  // `TextEditLayer` re-fits the box to the content instead of inheriting a
  // size the remaining text may no longer fill.
  const boxRect = useMemo(() => {
    const displayed = rotateRect(mark.rect, normalizeRotation(page.rotation - mark.rotationAtCreate))
    return {
      x: displayed.x,
      y: displayed.y,
      width: Math.min(displayed.width, TEXT_CLICK_BOX.width),
      height: Math.min(displayed.height, TEXT_CLICK_BOX.height),
    }
  }, [mark, page.rotation])

  const handleTextChange = useCallback((value: string) => {
    const sanitized = sanitizeAnnotationText(value)
    if (sanitized !== value) setStrippedUnsupported(true)
    setText(sanitized)
  }, [])

  const canSave = contentRect !== null && text.trim() !== ''

  const handleSave = () => {
    if (!contentRect || !canSave) return
    updateTextAnnotation(page.id, mark.id, {
      text,
      rect: contentRect,
      fontSizePt,
      colorHex,
      rotationAtCreate: page.rotation,
    })
    onDone()
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
                : 'Change the text, then press the ✓ next to the box to save it.'}
            </p>
          </div>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </>
      }
    >
      <PreviewSurface page={page} zoom={zoom}>
        {({ renderedSize, fittedSize }) => (
          <>
            <ExistingMarksOverlay page={page} hiddenMarkId={mark.id} />
            <TextEditLayer
              rect={boxRect}
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
          </>
        )}
      </PreviewSurface>
    </EditorPanel>
  )
}
