import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { displayedPageSizePt, TEXT_LINE_HEIGHT_EM } from '@/lib/annotationGeometry'
import { annotationFontFamilyFor } from '@/lib/annotationFont'
import type { NormalizedRect } from '@/domain/types'
import type { RenderedSize } from '@/hooks/usePagePreview'

/** Size of the confirm button and its gap from the box, in CSS px. */
const CONFIRM_SIZE_PX = 26
const CONFIRM_GAP_PX = 6

interface TextEditLayerProps {
  /** The box the user placed, in fractions of the displayed page. */
  rect: NormalizedRect
  fittedSize: { width: number; height: number }
  renderedSize: RenderedSize
  /** Intrinsic page size from the descriptor (points, or pixels ≙ points). */
  pageSize: { width: number; height: number }
  text: string
  fontSizePt: number
  colorHex: string
  onTextChange: (value: string) => void
  /** Reports the placed rect grown to fit the typed content, in page fractions. */
  onContentRectChange: (rect: NormalizedRect) => void
  /** Whether the current content is committable (non-blank). */
  canCommit: boolean
  /** Commit this box to the page and clear it for the next one. */
  onCommit: () => void
}

/**
 * In-place text editor over the page preview. The textarea renders at the
 * exact on-screen pixel size of the chosen font (pt → px via the page height
 * in points), never soft-wraps, and grows beyond the placed box to fit the
 * content — so what's typed is exactly what pdf-lib will draw.
 *
 * The tick button sits against the box rather than in the footer: the commit
 * belongs next to the thing being committed, and a footer button was read as
 * decoration rather than the required last step.
 */
export function TextEditLayer({
  rect,
  fittedSize,
  renderedSize,
  pageSize,
  text,
  fontSizePt,
  colorHex,
  onTextChange,
  onContentRectChange,
  canCommit,
  onCommit,
}: TextEditLayerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)

  const { heightPt } = displayedPageSizePt(pageSize, renderedSize.width / renderedSize.height)
  const fontSizePx = fontSizePt * (fittedSize.height / heightPt)
  const minWidthPx = rect.width * fittedSize.width
  const minHeightPx = rect.height * fittedSize.height
  const [sizePx, setSizePx] = useState({ width: minWidthPx, height: minHeightPx })

  // Re-focus whenever the box moves to a new spot, not only on first mount —
  // clicking elsewhere repositions this same editor rather than remounting it.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    // Caret at the end, which is where typing resumes when a box comes up
    // prefilled (re-editing a placed mark).
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [rect.x, rect.y])

  const { width: fittedWidthPx, height: fittedHeightPx } = fittedSize
  useLayoutEffect(() => {
    const measured = measureRef.current
    if (!measured) return
    // +2px keeps the caret visible at the end of the longest line.
    const width = Math.max(minWidthPx, measured.offsetWidth + 2)
    const height = Math.max(minHeightPx, measured.offsetHeight)
    setSizePx({ width, height })
    onContentRectChange({
      x: rect.x,
      y: rect.y,
      width: width / fittedWidthPx,
      height: height / fittedHeightPx,
    })
  }, [
    text,
    fontSizePx,
    minWidthPx,
    minHeightPx,
    rect.x,
    rect.y,
    fittedWidthPx,
    fittedHeightPx,
    onContentRectChange,
  ])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter inserts a line break (multi-line text is supported), so the
    // keyboard commit is the usual modifier form.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canCommit) {
      event.preventDefault()
      onCommit()
    }
  }

  const textStyle = {
    fontFamily: annotationFontFamilyFor(text),
    fontSize: fontSizePx,
    lineHeight: TEXT_LINE_HEIGHT_EM,
  }

  const boxLeftPx = rect.x * fittedWidthPx
  // Sit to the right of the box, or flip inside when that would overflow the page.
  const confirmRightOfBox = boxLeftPx + sizePx.width + CONFIRM_GAP_PX + CONFIRM_SIZE_PX
  const confirmLeftPx =
    confirmRightOfBox <= fittedWidthPx
      ? boxLeftPx + sizePx.width + CONFIRM_GAP_PX
      : Math.max(0, boxLeftPx - CONFIRM_GAP_PX - CONFIRM_SIZE_PX)

  return (
    <>
      <textarea
        ref={textareaRef}
        wrap="off"
        dir="auto"
        spellCheck={false}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Annotation text"
        className="absolute z-30 resize-none overflow-hidden whitespace-pre border border-dashed border-primary bg-transparent p-0 outline-none"
        style={{
          ...textStyle,
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: sizePx.width,
          height: sizePx.height,
          color: colorHex,
        }}
      />
      <button
        type="button"
        aria-label="Save text"
        title="Save text (⌘↵)"
        disabled={!canCommit}
        // Keep the caret in the textarea when this is pressed, so a disabled
        // press or a mis-click doesn't drop the user out of the box.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCommit}
        className="absolute z-30 flex items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        style={{
          left: confirmLeftPx,
          top: rect.y * fittedHeightPx,
          width: CONFIRM_SIZE_PX,
          height: CONFIRM_SIZE_PX,
        }}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </button>
      {/* Hidden twin used to measure the content's natural size. */}
      <div
        ref={measureRef}
        aria-hidden
        dir="auto"
        className="invisible absolute left-0 top-0 whitespace-pre"
        style={textStyle}
      >
        {`${text}​`}
      </div>
    </>
  )
}
