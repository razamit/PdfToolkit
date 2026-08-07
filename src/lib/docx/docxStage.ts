import type { PageChrome } from './docxRender'
import type { PageBand, PageMetrics } from './docxPaginate'

/**
 * Presents one band of a continuously-flowed document as a real, page-sized
 * element the rasterizer can capture.
 *
 * The flowed element is *moved* into the stage rather than cloned. Cloning
 * would be simpler, but a clone re-runs layout and re-decodes every image, so
 * line breaking could differ from the geometry the text layer was measured
 * against — and the two must agree exactly or selection drifts off the words.
 * Moving keeps one laid-out copy and just changes which part of it is visible.
 */

export interface Stage {
  /** The page-sized element to capture. */
  element: HTMLElement
  /** Show a band; the same stage is reused for every page. */
  show(band: PageBand): void
  /** Put the flowed element back so the host can be disposed cleanly. */
  dispose(): void
}

export function createStage(
  host: HTMLElement,
  flowed: HTMLElement,
  metrics: PageMetrics,
  header: PageChrome | null,
  footer: PageChrome | null,
): Stage {
  const parent = flowed.parentElement
  const nextSibling = flowed.nextSibling

  const stage = document.createElement('div')
  stage.style.cssText = [
    `width:${metrics.pageWidthPx}px`,
    `height:${metrics.pageHeightPx}px`,
    'position:relative',
    'overflow:hidden',
    'background:#ffffff',
  ].join(';')

  // The window is the printable area: content outside it belongs to the page
  // margins and must be clipped, or the tail of a band would bleed into the
  // bottom margin and collide with the footer.
  const windowHeight = metrics.pageHeightPx - metrics.marginTopPx - metrics.marginBottomPx
  const contentWindow = document.createElement('div')
  contentWindow.style.cssText = [
    'position:absolute',
    'left:0',
    `top:${metrics.marginTopPx}px`,
    `width:${metrics.pageWidthPx}px`,
    `height:${windowHeight}px`,
    'overflow:hidden',
  ].join(';')

  // Width and left offset are pinned to what was measured *before* the move.
  // The flowed element is a child of the padded page box, so it is narrower
  // than the page and inset by the left margin; giving it the page's full width
  // would re-break every line and invalidate every run the text layer measured.
  // Keeping both identical also makes the horizontal mapping an identity.
  const flowedWidth = flowed.getBoundingClientRect().width
  flowed.style.position = 'absolute'
  flowed.style.left = `${metrics.marginLeftPx}px`
  flowed.style.width = `${flowedWidth}px`

  contentWindow.appendChild(flowed)
  stage.appendChild(contentWindow)

  // Word draws the header and footer in the margins of *every* page;
  // docx-preview renders each exactly once, at the top and foot of the whole
  // flow. Cloning them onto the stage restores the repetition. Clones are safe
  // here: both are small, static, and nothing measures them.
  //
  // The header keeps its measured offset, because it is positioned within the
  // top margin (typically bottom-aligned against the text area) and that offset
  // is the same on every page. The footer cannot use its measured offset — in a
  // multi-page flow that is the foot of the *document*, not of a page — so it is
  // placed at the top of the bottom margin instead.
  appendChrome(stage, metrics, header, header?.offsetTopPx ?? 0)
  appendChrome(stage, metrics, footer, metrics.pageHeightPx - metrics.marginBottomPx)

  host.appendChild(stage)

  return {
    element: stage,
    show(band) {
      // Bands are in the flowed element's own space, so the offset is direct.
      flowed.style.top = `${-band.startPx}px`
    },
    dispose() {
      flowed.style.position = ''
      flowed.style.left = ''
      flowed.style.top = ''
      flowed.style.width = ''
      if (parent) parent.insertBefore(flowed, nextSibling)
      stage.remove()
    },
  }
}

function appendChrome(
  stage: HTMLElement,
  metrics: PageMetrics,
  chrome: PageChrome | null,
  topPx: number,
): void {
  if (!chrome) return
  const slot = document.createElement('div')
  slot.style.cssText = [
    'position:absolute',
    'left:0',
    `top:${topPx}px`,
    `width:${metrics.pageWidthPx}px`,
    `padding:0 ${metrics.marginLeftPx}px`,
    'box-sizing:border-box',
  ].join(';')
  slot.appendChild(chrome.element.cloneNode(true))
  stage.appendChild(slot)
}
