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
  /** Show a band; the same stage is reused for every page. */
  show(band: PageBand): void
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
  _header: PageChrome | null,
  footer: PageChrome | null,
): Stage {
  const saved: SavedStyle[] = []
  const remember = (element: HTMLElement) => {
    saved.push({ element, cssText: element.style.cssText })
  }

  remember(section)
  // A fixed height plus clipping turns the tall flow container into one page
  // box. Height and overflow do not affect how the children lay themselves out,
  // so this is safe where re-parenting was not.
  section.style.height = `${metrics.pageHeightPx}px`
  section.style.minHeight = `${metrics.pageHeightPx}px`
  section.style.overflow = 'hidden'
  section.style.position = 'relative'

  // The header needs nothing: docx-preview already places it inside the top
  // margin, at the same offset on every page, and it is not being moved.
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

  remember(flowed)
  const flowHeight = flowed.getBoundingClientRect().height

  return {
    element: section,
    show(band) {
      // `clip-path` selects the band in the element's own coordinates, then
      // `transform` slides that band up to where the content area starts. Both
      // are paint-only, so the flow underneath is identical on every page.
      const bottomInset = Math.max(0, flowHeight - band.endPx)
      flowed.style.clipPath = `inset(${band.startPx}px 0px ${bottomInset}px 0px)`
      flowed.style.transform = `translateY(${-band.startPx}px)`
    },
    dispose() {
      for (const entry of saved) entry.element.style.cssText = entry.cssText
    },
  }
}
