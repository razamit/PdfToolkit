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
): PageBand[] {
  if (bandHeightPx <= 0 || contentHeightPx <= 0) {
    return [{ startPx: 0, endPx: Math.max(0, contentHeightPx) }]
  }
  const maxPullback = bandHeightPx * MAX_PULLBACK_RATIO
  const sorted = [...unbreakable].sort((a, b) => a.top - b.top)

  const bands: PageBand[] = []
  let start = 0
  // Bounded rather than `while (start < contentHeightPx)`: a pathological
  // pull-back that failed to advance would otherwise spin forever.
  for (let guard = 0; guard < MAX_PAGES && start < contentHeightPx - 1; guard += 1) {
    const ideal = start + bandHeightPx
    if (ideal >= contentHeightPx) {
      bands.push({ startPx: start, endPx: contentHeightPx })
      break
    }
    const end = breakBefore(ideal, start + bandHeightPx - maxPullback, sorted)
    bands.push({ startPx: start, endPx: end })
    start = end
  }
  return bands.length > 0 ? bands : [{ startPx: 0, endPx: contentHeightPx }]
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
