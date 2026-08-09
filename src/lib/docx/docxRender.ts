import { flattenGeneratedContent } from './docxMarkers'
import type { PageMetrics } from './docxPaginate'

/**
 * Renders a .docx into paginated DOM using `docx-preview`, which implements
 * Word's own layout model (sections, page size and margins, styles, numbering,
 * tables, headers and footers) far more faithfully than anything reasonable to
 * write here.
 *
 * The container is real, laid-out DOM — not a screenshot — because both later
 * stages need geometry from it: the rasterizer captures each page element, and
 * the text layer reads each run's client rects to place invisible, selectable
 * text over the raster.
 */

/** docx-preview emits one of these per rendered page when `breakPages` is on. */
const PAGE_SELECTOR = 'section.docx'

export interface RenderedDocx {
  /** Detached host element holding the rendered document. Caller must dispose. */
  host: HTMLElement
  pages: HTMLElement[]
}

/**
 * Rendered off-screen but **not** hidden: `display: none` and `visibility:
 * hidden` both collapse layout, and every measurement downstream depends on the
 * browser having actually laid this out. Positioning it far outside the
 * viewport keeps it invisible while remaining fully measurable.
 */
const HOST_CLASS = 'docx-render-host'

/**
 * The app's own global CSS reaches into this container and must be neutralised.
 *
 * Tailwind's preflight sets `img { max-width: 100% }`. docx-preview implements a
 * floating (`wp:anchor`) image as an image inside a **zero-size** positioned
 * wrapper — which is the correct technique — so that rule resolves 100% of zero
 * and collapses the image to `0px` wide while keeping its height. The result is
 * an invisible signature or logo, with the rest of the page laid out around a
 * shape that is not there. Measured on a real contract: `0x128` before,
 * `199x128` after, against a declared `149.39pt × 96.03pt`.
 *
 * Scoped to this host so the app's own images keep the reset they rely on.
 */
const HOST_STYLE = `
.${HOST_CLASS} img,
.${HOST_CLASS} svg {
  max-width: none !important;
  max-height: none !important;
}
`

const STYLE_ELEMENT_ID = 'docx-render-host-style'

/**
 * The override lives in `document.head`, not inside the host: `renderAsync`
 * empties its container before rendering, so a `<style>` placed in the host is
 * silently discarded and the fix appears not to work. The selector is scoped to
 * the host's class, so nothing outside the converter is affected.
 */
function ensureHostStyle(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = HOST_STYLE
  document.head.appendChild(style)
}

function createHost(): HTMLElement {
  ensureHostStyle()
  const host = document.createElement('div')
  host.className = HOST_CLASS
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:absolute;left:-100000px;top:0;width:auto;pointer-events:none;background:#ffffff'
  document.body.appendChild(host)
  return host
}

/**
 * `renderAsync` resolves when the DOM is built, not when its images have
 * decoded — they are blob URLs fetched asynchronously. Measuring or capturing
 * before then reads a layout in which every image is still 0×0, so the text
 * layer gets wrong geometry and the raster is taken with the images missing.
 *
 * The double `requestAnimationFrame` afterwards lets the browser complete the
 * reflow that decoding triggers, so the first measurement sees final geometry.
 */
async function awaitImages(host: HTMLElement): Promise<void> {
  const images = Array.from(host.querySelectorAll('img'))
  await Promise.all(
    images.map((image) =>
      image.complete && image.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            // A broken image must not hang the conversion; the page still
            // renders, simply without that picture.
            image.addEventListener('error', () => resolve(), { once: true })
          }),
    ),
  )
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export async function renderDocx(bytes: Uint8Array): Promise<RenderedDocx> {
  const { renderAsync } = await import('docx-preview')
  const host = createHost()
  try {
    await renderAsync(new Blob([bytes as BlobPart]), host, undefined, {
      inWrapper: true,
      // Pagination is the whole reason this library is here: it is what turns a
      // flow document into discrete pages the rasterizer can capture one by one.
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      experimental: true,
    })
  } catch (error) {
    host.remove()
    throw error
  }
  await awaitImages(host)
  // Before anything measures or captures, so the text layer and the raster both
  // see resolved list markers rather than unresolved counters.
  flattenGeneratedContent(host)
  const pages = Array.from(host.querySelectorAll<HTMLElement>(PAGE_SELECTOR))
  return { host, pages }
}

/**
 * Read a rendered page's geometry.
 *
 * `min-height` rather than `height` is the page height: docx-preview sets the
 * real page box as a minimum and lets the element grow past it when the content
 * does not fit, which is exactly the overflow this module's caller paginates.
 * Reading `height` would define a page as "however tall the document is" and
 * produce one enormous page every time.
 */
export function readPageMetrics(page: HTMLElement): PageMetrics {
  const style = getComputedStyle(page)
  const rect = page.getBoundingClientRect()
  const declaredHeight = parseFloat(style.minHeight)
  return {
    pageWidthPx: rect.width,
    pageHeightPx: Number.isFinite(declaredHeight) && declaredHeight > 0 ? declaredHeight : rect.height,
    marginTopPx: parseFloat(style.paddingTop) || 0,
    marginBottomPx: parseFloat(style.paddingBottom) || 0,
    marginLeftPx: parseFloat(style.paddingLeft) || 0,
  }
}

/** A header or footer, with where it sat relative to the rendered page's top. */
export interface PageChrome {
  element: HTMLElement
  offsetTopPx: number
}

/**
 * The three parts of a rendered page, which are handled differently: the
 * article is windowed one band at a time, while the header and footer are
 * *repeated* on every page the way Word draws them. docx-preview renders each
 * of them exactly once, at the top and foot of the whole flow.
 */
export function splitPageParts(page: HTMLElement): {
  flowed: HTMLElement | null
  header: PageChrome | null
  footer: PageChrome | null
  /** Footnote list for the section, rendered once as a sibling of the article. */
  footnotes: HTMLElement | null
} {
  const children = Array.from(page.children) as HTMLElement[]
  const pageTop = page.getBoundingClientRect().top
  const chrome = (tag: string): PageChrome | null => {
    const element = children.find((child) => child.tagName === tag)
    if (!element) return null
    return { element, offsetTopPx: element.getBoundingClientRect().top - pageTop }
  }
  return {
    flowed: children.find((child) => child.tagName === 'ARTICLE') ?? children[0] ?? null,
    header: chrome('HEADER'),
    footer: chrome('FOOTER'),
    // docx-preview collects a section's footnotes into a single ordered list
    // placed after the article. Left alone it is neither windowed nor staged,
    // so the reference marks render and their text silently does not.
    footnotes: children.find((child) => child.tagName === 'OL') ?? null,
  }
}
