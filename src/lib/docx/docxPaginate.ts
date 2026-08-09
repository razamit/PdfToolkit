/**
 * Splits one continuously-flowed rendered document into page bands.
 *
 * Bands are in the **flowed element's own space**, starting at 0, so they are
 * measured in the same coordinate system the caller later renders in. An
 * earlier version worked in page-element space and measured before the element
 * was staged; repositioning it changed margin collapsing, so the geometry the
 * bands were computed from no longer matched the pixels being captured and
 * every break shaved a sliver off the following page.
 *
 * This exists because `docx-preview` does not paginate. It honours *explicit*
 * page and section breaks, and otherwise lays the whole document out in a
 * single element with `min-height` set to the page height and no maximum — so a
 * three-page contract with no manual breaks renders as one 3,356px-tall page.
 * Most real Word documents contain no explicit breaks, so this is the normal
 * case rather than an edge case.
 *
 * The bands computed here are in the rendered element's own pixel space. The
 * caller maps each band onto a real page.
 */

export interface PageMetrics {
  /** Full page box, including margins, in CSS pixels. */
  pageWidthPx: number
  pageHeightPx: number
  marginTopPx: number
  marginBottomPx: number
  marginLeftPx: number
}

export interface PageBand {
  /** Element-space y where this page's content starts. */
  startPx: number
  /** Element-space y where it ends (exclusive). */
  endPx: number
}

/** A box that must not be cut in half — a line of text, an image, a table row. */
export interface UnbreakableBox {
  top: number
  bottom: number
}

/**
 * How far a break may be pulled back from its ideal position to avoid slicing
 * through a line. Beyond this the page would be left conspicuously short, which
 * looks more broken than a tight break does, so the ideal position wins.
 */
const MAX_PULLBACK_RATIO = 0.25

export function computePageBands(
  bandHeightPx: number,
  contentHeightPx: number,
  unbreakable: UnbreakableBox[],
  /**
   * Extra height this page must give up — footnotes, which occupy the foot of
   * the page they are referenced from and therefore shorten the text area.
   * Called with a provisional band because what a page reserves depends on what
   * it contains, and what it contains depends on what it reserves.
   */
  reserveFor?: (startPx: number, endPx: number) => number,
): PageBand[] {
  if (bandHeightPx <= 0 || contentHeightPx <= 0) {
    return [{ startPx: 0, endPx: Math.max(0, contentHeightPx) }]
  }
  const sorted = [...unbreakable].sort((a, b) => a.top - b.top)

  const bands: PageBand[] = []
  let start = 0
  for (let guard = 0; guard < MAX_PAGES && start < contentHeightPx - 1; guard += 1) {
    const end = settleBand(start, bandHeightPx, contentHeightPx, sorted, reserveFor)
    bands.push({ startPx: start, endPx: end })
    if (end <= start) break
    start = end
  }
  return bands.length > 0 ? bands : [{ startPx: 0, endPx: contentHeightPx }]
}

/**
 * Resolve one band's end. Two passes at most: the first finds what the page
 * would hold at full height, the second re-cuts it against whatever that
 * content reserves. Iterating further could oscillate between two answers, and
 * a page one line short is a far smaller error than a loop that never settles.
 */
function settleBand(
  start: number,
  bandHeightPx: number,
  contentHeightPx: number,
  sorted: UnbreakableBox[],
  reserveFor?: (startPx: number, endPx: number) => number,
): number {
  let available = bandHeightPx
  let end = Math.min(start + available, contentHeightPx)
  for (let pass = 0; pass < 2; pass += 1) {
    const ideal = start + available
    end = ideal >= contentHeightPx
      ? contentHeightPx
      : breakBefore(ideal, start + available - available * MAX_PULLBACK_RATIO, sorted)
    if (!reserveFor) break
    const reserved = reserveFor(start, end)
    const next = Math.max(bandHeightPx * 0.25, bandHeightPx - reserved)
    if (Math.abs(next - available) < 1) break
    available = next
  }
  return end
}

/** Safety valve; a document this long is a bug or an attack, not a document. */
const MAX_PAGES = 500


/**
 * Find the highest break at or below `ideal` that no box straddles, without
 * going above `floor`. Boxes are half-open: a box ending exactly at the break
 * is fine, since nothing is cut.
 */
function breakBefore(ideal: number, floor: number, sorted: UnbreakableBox[]): number {
  let candidate = ideal
  // Repeat because pulling above one line can land inside the line above it.
  for (let pass = 0; pass < 8; pass += 1) {
    const straddling = sorted.find((box) => box.top < candidate && box.bottom > candidate)
    if (!straddling) return candidate
    if (straddling.top <= floor) return ideal
    candidate = straddling.top
  }
  return candidate > floor ? candidate : ideal
}
