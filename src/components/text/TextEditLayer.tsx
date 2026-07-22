import { useLayoutEffect, useRef, useState } from 'react'
import { displayedPageSizePt, TEXT_LINE_HEIGHT_EM } from '@/lib/annotationGeometry'
import { annotationFontFamilyFor } from '@/lib/annotationFont'
import type { NormalizedRect } from '@/domain/types'
import type { RenderedSize } from '@/hooks/usePagePreview'

interface TextEditLayerProps {
  /** The box the user dragged, in fractions of the displayed page. */
  rect: NormalizedRect
  fittedSize: { width: number; height: number }
  renderedSize: RenderedSize
  /** Intrinsic page size from the descriptor (points, or pixels ≙ points). */
  pageSize: { width: number; height: number }
  text: string
  fontSizePt: number
  colorHex: string
  onTextChange: (value: string) => void
  /** Reports the drawn rect grown to fit the typed content, in page fractions. */
  onContentRectChange: (rect: NormalizedRect) => void
}

/**
 * In-place text editor over the page preview. The textarea renders at the
 * exact on-screen pixel size of the chosen font (pt → px via the page height
 * in points), never soft-wraps, and grows beyond the drawn box to fit the
 * content — so what's typed is exactly what pdf-lib will draw.
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
}: TextEditLayerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)

  const { heightPt } = displayedPageSizePt(pageSize, renderedSize.width / renderedSize.height)
  const fontSizePx = fontSizePt * (fittedSize.height / heightPt)
  const minWidthPx = rect.width * fittedSize.width
  const minHeightPx = rect.height * fittedSize.height
  const [sizePx, setSizePx] = useState({ width: minWidthPx, height: minHeightPx })

  useLayoutEffect(() => {
    textareaRef.current?.focus()
  }, [])

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

  const textStyle = {
    fontFamily: annotationFontFamilyFor(text),
    fontSize: fontSizePx,
    lineHeight: TEXT_LINE_HEIGHT_EM,
  }

  return (
    <>
      <textarea
        ref={textareaRef}
        wrap="off"
        dir="auto"
        spellCheck={false}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
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
