import type { UnbreakableBox } from './docxPaginate'

/**
 * Harvests the position of every word in a rendered page so the converted PDF
 * can carry an invisible, selectable text layer over its raster.
 *
 * This is what keeps route 2 from being a photograph of a document. The raster
 * preserves exactly what the browser drew — borders, shading, bullets, images,
 * every detail a hand-written renderer would have to reimplement — while this
 * layer restores the two things a raster destroys: text selection and search.
 *
 * Positions come from the browser's own layout via `Range` rects, so unlike the
 * OCR path there is no recognition step and no confidence: the text is exact,
 * because it is read from the DOM rather than guessed from pixels.
 *
 * Coordinates are **element pixels**, not fractions, because the caller has to
 * slice this document into pages before it knows what any run is a fraction of.
 */

export interface DocxTextRun {
  text: string
  /** Word box in CSS pixels, relative to the rendered element's top-left. */
  x: number
  y: number
  width: number
  height: number
}

/** Below this the rect is a layout artefact (collapsed inline, zero-width span). */
const MIN_RUN_SIZE_PX = 0.5

export function extractTextRuns(page: HTMLElement): DocxTextRun[] {
  const pageBox = page.getBoundingClientRect()
  if (pageBox.width <= 0 || pageBox.height <= 0) return []

  const runs: DocxTextRun[] = []
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      isRenderedText(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })

  let node = walker.nextNode() as Text | null
  while (node) {
    collectWords(node, pageBox, runs)
    node = walker.nextNode() as Text | null
  }
  return runs
}

/**
 * Boxes a page break must not cut through: every line of text, plus images and
 * table rows, which look far worse sliced than text does.
 */
/**
 * Grown slightly beyond the measured box because glyph ink is not confined to
 * it: descenders, accents and tall faces paint a pixel or two outside the rect
 * `getClientRects` reports. A break landing exactly on a boundary therefore
 * shaves a sliver of the line onto the next page — visible as a thin smear
 * along the top edge, which looks worse than the clean break it nearly was.
 */
const INK_BLEED_PX = 3

export function extractUnbreakableBoxes(page: HTMLElement, runs: DocxTextRun[]): UnbreakableBox[] {
  const pageBox = page.getBoundingClientRect()
  const boxes: UnbreakableBox[] = runs.map((run) => ({
    top: run.y - INK_BLEED_PX,
    bottom: run.y + run.height + INK_BLEED_PX,
  }))
  for (const element of page.querySelectorAll<HTMLElement>('img, tr, svg')) {
    const rect = element.getBoundingClientRect()
    if (rect.height < MIN_RUN_SIZE_PX) continue
    boxes.push({ top: rect.top - pageBox.top, bottom: rect.bottom - pageBox.top })
  }
  return boxes
}

/**
 * Skip text that is present in the DOM but not painted. `getClientRects` would
 * return an empty list for most of these anyway, but `visibility: hidden` text
 * keeps its boxes — it would produce selectable words floating over blank
 * space, which is worse than omitting them.
 */
function isRenderedText(node: Text): boolean {
  if (!node.data || node.data.trim() === '') return false
  const parent = node.parentElement
  if (!parent) return false
  const style = getComputedStyle(parent)
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0
}

/**
 * One rect per word rather than per text node. A text node can wrap across
 * several lines, and a single box around all of it would cover blank space and
 * make selection land on the wrong line; per-word boxes follow the wrap.
 */
function collectWords(node: Text, pageBox: DOMRect, out: DocxTextRun[]): void {
  const text = node.data
  const range = document.createRange()
  for (const { start, end } of wordSpans(text)) {
    range.setStart(node, start)
    range.setEnd(node, end)
    const rect = principalRect(range)
    if (!rect) continue
    out.push({
      text: text.slice(start, end),
      x: rect.left - pageBox.left,
      y: rect.top - pageBox.top,
      width: rect.width,
      height: rect.height,
    })
  }
  range.detach()
}

/**
 * The single box to represent a word, or `null` if it is not painted.
 *
 * A range can report more than one client rect — a word sitting across a soft
 * line break, or split by an inline box boundary. Emitting the word once per
 * rect writes its *whole text* several times into the layer, so a reader
 * extracts and finds it repeatedly ("margin, margin, margin,"). One word means
 * one entry, placed on the largest fragment, which is the line it visually
 * belongs to.
 */
function principalRect(range: Range): DOMRect | null {
  let best: DOMRect | null = null
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < MIN_RUN_SIZE_PX || rect.height < MIN_RUN_SIZE_PX) continue
    if (!best || rect.width * rect.height > best.width * best.height) best = rect
  }
  return best
}

interface WordSpan {
  start: number
  end: number
}

/** Character offsets of each whitespace-delimited word within `text`. */
function wordSpans(text: string): WordSpan[] {
  const spans: WordSpan[] = []
  let start = -1
  for (let index = 0; index <= text.length; index += 1) {
    const isSpace = index === text.length || /\s/.test(text[index])
    if (isSpace) {
      if (start >= 0) spans.push({ start, end: index })
      start = -1
    } else if (start < 0) {
      start = index
    }
  }
  return spans
}
