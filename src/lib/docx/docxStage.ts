import type { PageChrome } from './docxRender'
import type { PageBand, PageMetrics } from './docxPaginate'

/**
 * Presents one band of a continuously-flowed document as a real, page-sized
 * element the rasterizer can capture.
 *
 * The flowed element is never moved, re-parented or re-sized. Windowing is done
 * entirely with `transform` and `clip-path`, which are **paint-time** operations
 * and cannot reflow anything.
 *
 * That constraint is the whole design, and it was learned the hard way. An
 * earlier version moved the flow into a clipping container and set it to
 * `position: absolute`, which stops its child margins collapsing with their
 * parent — on a real report that inflated the content from 2,908px to 4,752px
 * and turned a seven-page document into fifteen. Measuring after the move made
 * the bands self-consistent but preserved the wrong layout. Nothing here may
 * touch a property that participates in layout.
 */

export interface Stage {
  /** The page-sized element to capture. */
  element: HTMLElement
  /** Header/footer elements visible on the current page, for field values. */
  chromeFor(isFirstPage: boolean): HTMLElement[]
  /** Show a band, with the footnotes referenced from it. */
  show(band: PageBand, footnotes: HTMLElement[], isFirstPage: boolean): void
  /** Restore every property this touched. */
  dispose(): void
}

interface SavedStyle {
  element: HTMLElement
  cssText: string
}

export function createStage(
  section: HTMLElement,
  flowed: HTMLElement,
  metrics: PageMetrics,
  header: PageChrome | null,
  footer: PageChrome | null,
  footnoteList: HTMLElement | null,
  /** Header for pages after the first, when the section declares a title page. */
  laterHeader: HTMLElement | null,
): Stage {
  const saved: SavedStyle[] = []
  const remember = (element: HTMLElement) => {
    saved.push({ element, cssText: element.style.cssText })
  }

  remember(section)
  if (header) remember(header.element)
  // A fixed height plus clipping turns the tall flow container into one page
  // box. Height and overflow do not affect how the children lay themselves out,
  // so this is safe where re-parenting was not.
  section.style.height = `${metrics.pageHeightPx}px`
  section.style.minHeight = `${metrics.pageHeightPx}px`
  section.style.overflow = 'hidden'
  section.style.position = 'relative'

  // The header needs nothing on its own: docx-preview already places it inside
  // the top margin, at the same offset on every page, and it is not moved.
  //
  // A `titlePg` section is the exception. Only its *first-page* header is in
  // the DOM, so a second copy — recovered by re-rendering without the flag —
  // is parked in the same slot and swapped in from page two onward. Without
  // this the title page's banner repeats through the whole document.
  let laterSlot: HTMLElement | null = null
  if (header && laterHeader) {
    const rect = header.element.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    laterSlot = document.createElement('div')
    laterSlot.style.cssText = [
      'position:absolute',
      `left:${rect.left - sectionRect.left}px`,
      `top:${header.offsetTopPx}px`,
      `width:${rect.width}px`,
      'display:none',
    ].join(';')
    laterSlot.appendChild(laterHeader.cloneNode(true))
    section.appendChild(laterSlot)
  }

  if (footer) {
    remember(footer.element)
    const rect = footer.element.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    // Taken out of flow so it sits in the bottom margin of *this* page rather
    // than at the foot of the whole document. Safe because it is the last child
    // — nothing after it can be displaced.
    footer.element.style.position = 'absolute'
    footer.element.style.left = `${rect.left - sectionRect.left}px`
    footer.element.style.width = `${rect.width}px`
    footer.element.style.top = `${metrics.pageHeightPx - metrics.marginBottomPx}px`
    footer.element.style.margin = '0'
  }

  // The section's whole footnote list is taken out of flow and hidden; a slot
  // above the footer receives clones of just the notes each page references.
  let slot: HTMLElement | null = null
  if (footnoteList) {
    remember(footnoteList)
    footnoteList.style.display = 'none'
    slot = document.createElement('div')
    slot.style.cssText = [
      'position:absolute',
      'left:0',
      `width:${metrics.pageWidthPx}px`,
      `padding:0 ${metrics.marginLeftPx}px`,
      'box-sizing:border-box',
      'border-top:0.75pt solid #999',
      'padding-top:3pt',
      'margin:0',
    ].join(';')
    section.appendChild(slot)
  }

  remember(flowed)
  const flowHeight = flowed.getBoundingClientRect().height


  return {
    element: section,
    chromeFor(isFirstPage) {
      const visible: HTMLElement[] = []
      if (header && (!laterSlot || isFirstPage)) visible.push(header.element)
      if (laterSlot && !isFirstPage) visible.push(laterSlot)
      if (footer) visible.push(footer.element)
      return visible
    },
    show(band, footnotes, isFirstPage) {
      if (laterSlot && header) {
        laterSlot.style.display = isFirstPage ? 'none' : 'block'
        header.element.style.visibility = isFirstPage ? '' : 'hidden'
      }
      if (slot) {
        slot.replaceChildren(...footnotes.map((note) => note.cloneNode(true)))
        slot.style.display = footnotes.length > 0 ? 'block' : 'none'
        // Sat directly on the bottom margin, growing upward, which is where
        // Word puts them; measured after filling because the height varies
        // with how many notes this particular page happens to reference.
        const height = slot.getBoundingClientRect().height
        slot.style.top = `${metrics.pageHeightPx - metrics.marginBottomPx - height}px`
      }
      // `clip-path` selects the band in the element's own coordinates, then
      // `transform` slides that band up to where the content area starts. Both
      // are paint-only, so the flow underneath is identical on every page.
      const bottomInset = Math.max(0, flowHeight - band.endPx)
      flowed.style.clipPath = `inset(${band.startPx}px 0px ${bottomInset}px 0px)`
      flowed.style.transform = `translateY(${-band.startPx}px)`
    },
    dispose() {
      slot?.remove()
      laterSlot?.remove()
      if (header) header.element.style.visibility = ''
      for (const entry of saved) entry.element.style.cssText = entry.cssText
    },
  }
}
