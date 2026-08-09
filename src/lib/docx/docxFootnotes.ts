import type { PageBand } from './docxPaginate'

/**
 * Places each footnote on the page that references it.
 *
 * `docx-preview` renders a section's footnotes as one ordered list after the
 * article — every note for every page, in one block. Printing that block
 * verbatim would put all of a document's footnotes at the foot of whichever
 * page happened to hold the list, which is endnote behaviour, not footnote
 * behaviour.
 *
 * The mapping back to pages is available in the DOM: each reference mark in the
 * body carries the footnote's id, and each list item carries the same id. So a
 * band's footnotes are the notes whose reference marks fall inside it.
 */

const REFERENCE_SELECTOR = '.docx_footnotereference, [class*="footnotereference"]'

interface FootnoteRef {
  /** 1-based position of this note within the rendered list. */
  index: number
  /** Reference position in the flowed element's own space. */
  y: number
}

export interface FootnoteIndex {
  refs: FootnoteRef[]
  items: HTMLElement[]
}

/**
 * Read the reference positions and list items once, before any staging.
 *
 * The join is positional, not by id: docx-preview emits no shared attribute
 * between a reference mark and its note, but it renders in each mark the note's
 * 1-based position within the list it also generates. That number is the only
 * link the DOM offers, and it survives the library rendering more list items
 * than the document has footnotes.
 */
export function indexFootnotes(flowed: HTMLElement, list: HTMLElement | null): FootnoteIndex {
  const flowTop = flowed.getBoundingClientRect().top
  const refs: FootnoteRef[] = []
  for (const mark of flowed.querySelectorAll<HTMLElement>(REFERENCE_SELECTOR)) {
    const index = Number((mark.textContent ?? '').trim())
    if (!Number.isInteger(index) || index < 1) continue
    refs.push({ index, y: mark.getBoundingClientRect().top - flowTop })
  }
  return { refs, items: list ? (Array.from(list.children) as HTMLElement[]) : [] }
}

/**
 * Height the notes referenced in this range will occupy, including the rule
 * above them. Measured from the list as originally rendered, which shares the
 * width and type size of the slot they are cloned into.
 */
export function footnoteHeightFor(index: FootnoteIndex, startPx: number, endPx: number): number {
  const notes = notesIn(index, startPx, endPx)
  if (notes.length === 0) return 0
  const total = notes.reduce((sum, note) => sum + note.getBoundingClientRect().height, 0)
  return total + FOOTNOTE_RULE_GAP_PX
}

/** Room for the separator rule and its padding above the first note. */
const FOOTNOTE_RULE_GAP_PX = 8

/** The notes whose reference marks fall inside `band`, in document order. */
export function footnotesForBand(index: FootnoteIndex, band: PageBand): HTMLElement[] {
  return notesIn(index, band.startPx, band.endPx)
}

function notesIn(index: FootnoteIndex, startPx: number, endPx: number): HTMLElement[] {
  const seen = new Set<number>()
  const notes: HTMLElement[] = []
  for (const ref of index.refs) {
    if (ref.y < startPx || ref.y >= endPx) continue
    if (seen.has(ref.index)) continue
    seen.add(ref.index)
    const item = index.items[ref.index - 1]
    if (item) notes.push(item)
  }
  return notes
}
