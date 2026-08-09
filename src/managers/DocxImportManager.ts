import { PDFDocument, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import { fetchAnnotationFontBytes } from '@/lib/annotationFont'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { loadDocxSubstituteFonts } from '@/lib/docx/docxFonts'
import { computePageBands, type PageBand, type PageMetrics } from '@/lib/docx/docxPaginate'
import { rasterizePage } from '@/lib/docx/docxRasterize'
import { readPageMetrics, renderDocx, splitPageParts } from '@/lib/docx/docxRender'
import { hasTitlePage, withoutTitlePage } from '@/lib/docx/docxTitlePage'
import { applyFields, clearFields, readFieldPlans, type FieldPlan } from '@/lib/docx/docxFields'
import { footnoteHeightFor, footnotesForBand, indexFootnotes } from '@/lib/docx/docxFootnotes'
import { createStage } from '@/lib/docx/docxStage'
import { extractTextRuns, extractUnbreakableBoxes, type DocxTextRun } from '@/lib/docx/docxTextLayer'
import { SourceLoadError } from '@/domain/errors'

/**
 * Converts a Word document to PDF **on the device**, then hands the bytes back
 * so the ordinary PDF ingest path takes over — the same shape as the
 * spreadsheet importer, and for the same reason: everything downstream then
 * works on the result without knowing where it came from.
 *
 * The strategy differs from spreadsheets on purpose. A sheet is values, so it
 * is redrawn as text. A Word document is a *layout*, and people convert CVs and
 * contracts where "it doesn't look like my document" is the whole failure. So
 * each page is a raster of the browser's own rendering of Word's layout model,
 * with an invisible text layer over it restoring selection and search.
 *
 * Pagination is ours, not the renderer's: `docx-preview` flows the whole
 * document into one element and only honours *explicit* page breaks, which most
 * real documents do not contain. See `docxPaginate.ts`.
 *
 * What that costs, stated plainly: pages are images, so they are larger than a
 * text PDF and soften under heavy zoom. See `docs/DECISIONS.md`.
 */

/** CSS pixels are 96 per inch; PDF user space is 72 per inch. */
const PX_TO_PT = 72 / 96

/** Matches the OCR text layer's ratio of drawn size to measured box height. */
const FONT_SIZE_RATIO = 0.8

export type WordFormat = 'docx'

const DOCX_EXTENSIONS = ['.docx']

/** Recognised but unreadable, so the failure can name the problem and the fix. */
const UNREADABLE_FORMATS: Record<string, string> = {
  '.doc': 'the older binary Word format',
  '.rtf': 'Rich Text Format',
  '.odt': 'the OpenDocument text format',
  '.pages': "Apple's Pages format",
  '.dotx': 'a Word *template*',
}

export function wordFormatOf(file: File): WordFormat | null {
  const name = file.name.toLowerCase()
  if (DOCX_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'docx'
  return file.type.endsWith('wordprocessingml.document') ? 'docx' : null
}

export function unsupportedWordReason(file: File): string | null {
  const name = file.name.toLowerCase()
  for (const [extension, description] of Object.entries(UNREADABLE_FORMATS)) {
    if (name.endsWith(extension)) {
      return `"${file.name}" is ${description}, which can't be read in the browser. Re-save it as .docx and try again.`
    }
  }
  return null
}

export class DocxImportManager {
  /** Read `file` and return the bytes of a PDF rendering of its pages. */
  async convertToPdfBytes(file: File): Promise<Uint8Array> {
    // Fonts first: rasterizing before the substitutes land captures fallback
    // glyphs, and the resulting page looks like a fidelity bug rather than the
    // race it is. A font failure is not fatal — the document still renders.
    await loadDocxSubstituteFonts().catch(() => undefined)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const rendered = await this.render(file, bytes)
    // Only paid for by documents that actually declare a title page.
    const laterHeaders = await this.renderLaterHeaders(bytes)
    try {
      if (rendered.pages.length === 0) {
        throw new SourceLoadError(`"${file.name}" has no pages to convert.`)
      }
      const document = await PDFDocument.create()
      document.setTitle(file.name)
      const font = await embedTextLayerFont(document)

      // Two passes, because a `NUMPAGES` field cannot be written until every
      // section has been paginated. Pass one only measures — nothing is staged,
      // so the geometry it reads is the pristine layout.
      const plans = rendered.pages.map((section) => this.planSection(section))
      const totalPages = plans.reduce((sum, plan) => sum + (plan?.bands.length ?? 0), 0)
      const fieldPlans = await readFieldPlans(bytes)

      let pageNumber = 0
      for (const [index, plan] of plans.entries()) {
        if (!plan) continue
        pageNumber = await this.renderSection(document, plan, font, {
          laterSection: laterHeaders?.pages[index] ?? null,
          fieldPlans,
          firstPageNumber: pageNumber + 1,
          totalPages,
        })
      }
      return document.save()
    } finally {
      rendered.host.remove()
      laterHeaders?.host.remove()
    }
  }

  private async render(
    file: File,
    bytes: Uint8Array,
  ): Promise<Awaited<ReturnType<typeof renderDocx>>> {
    try {
      return await renderDocx(bytes)
    } catch {
      throw new SourceLoadError(
        `"${file.name}" could not be opened — it may be corrupted, password-protected, or not a real .docx file.`,
      )
    }
  }

  /**
   * Re-render with `titlePg` stripped, purely to obtain each section's *default*
   * header — docx-preview renders only the first-page one when the flag is set.
   * Returns `null` for the overwhelming majority of documents, which have no
   * title page and must not pay for a second render.
   */
  private async renderLaterHeaders(
    bytes: Uint8Array,
  ): Promise<Awaited<ReturnType<typeof renderDocx>> | null> {
    try {
      if (!(await hasTitlePage(bytes))) return null
      const stripped = await withoutTitlePage(bytes)
      return stripped ? await renderDocx(stripped) : null
    } catch {
      return null
    }
  }

  /**
   * Measure a section and choose its page breaks, without staging anything.
   * Separated from rendering so the whole document's page count is known before
   * the first page is drawn, which is what `NUMPAGES` needs.
   */
  private planSection(section: HTMLElement): SectionPlan | null {
    const metrics = readPageMetrics(section)
    const { flowed, header, footer, footnotes } = splitPageParts(section)
    if (!flowed) return null

    const runs = extractTextRuns(flowed)
    const bandHeight = metrics.pageHeightPx - metrics.marginTopPx - metrics.marginBottomPx
    const footnoteIndex = indexFootnotes(flowed, footnotes)
    const bands = computePageBands(
      bandHeight,
      flowed.getBoundingClientRect().height,
      extractUnbreakableBoxes(flowed, runs),
      (startPx, endPx) => footnoteHeightFor(footnoteIndex, startPx, endPx),
    )
    return {
      section,
      flowed,
      metrics,
      header,
      footer,
      footnotes,
      footnoteIndex,
      bands,
      buckets: bucketRunsByBand(runs, bands),
    }
  }

  /** Draw a planned section's pages. Returns the last page number used. */
  private async renderSection(
    document: PDFDocument,
    plan: SectionPlan,
    font: PDFFont,
    context: RenderContext,
  ): Promise<number> {
    const laterHeader = context.laterSection ? splitPageParts(context.laterSection).header : null
    const stage = createStage(
      plan.section,
      plan.flowed,
      plan.metrics,
      plan.header,
      plan.footer,
      plan.footnotes,
      laterHeader?.element ?? null,
    )
    let pageNumber = context.firstPageNumber
    try {
      for (const [index, band] of plan.bands.entries()) {
        const isFirstPage = index === 0
        stage.show(band, footnotesForBand(plan.footnoteIndex, band), isFirstPage)
        const chrome = stage.chromeFor(isFirstPage)
        for (const element of chrome) {
          clearFields(element)
          applyFields(element, context.fieldPlans, pageNumber, context.totalPages)
        }
        await this.addPage(document, stage.element, plan.metrics, band, plan.buckets[index], font)
        for (const element of chrome) clearFields(element)
        pageNumber += 1
      }
    } finally {
      stage.dispose()
    }
    return pageNumber - 1
  }

  private async addPage(
    document: PDFDocument,
    stageElement: HTMLElement,
    metrics: PageMetrics,
    band: PageBand,
    runs: DocxTextRun[],
    font: PDFFont,
  ): Promise<void> {
    const raster = await rasterizePage(stageElement)
    const widthPt = metrics.pageWidthPx * PX_TO_PT
    const heightPt = metrics.pageHeightPx * PX_TO_PT
    const page = document.addPage([widthPt, heightPt])

    const image = await document.embedPng(raster.bytes)
    page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })
    drawInvisibleText(page, runs, metrics, band, font, widthPt, heightPt)
  }
}

interface SectionPlan {
  section: HTMLElement
  flowed: HTMLElement
  metrics: PageMetrics
  header: ReturnType<typeof splitPageParts>['header']
  footer: ReturnType<typeof splitPageParts>['footer']
  footnotes: HTMLElement | null
  footnoteIndex: ReturnType<typeof indexFootnotes>
  bands: PageBand[]
  buckets: DocxTextRun[][]
}

interface RenderContext {
  laterSection: HTMLElement | null
  fieldPlans: FieldPlan[]
  firstPageNumber: number
  totalPages: number
}

/**
 * Assign every word to exactly one page, by which band holds its **midpoint**.
 *
 * Requiring full containment instead looks stricter and is simply wrong in both
 * directions. Text routinely paints outside the flow's box — a heading's line
 * box measured at `y = -4` put the whole title page's text above the first
 * band, and every word of it was silently dropped from the text layer. At the
 * other end, a word straddling a break belonged to no band at all. A midpoint
 * always lands somewhere, so no word can fall through, and clamping covers
 * anything that overshoots the first or last band.
 */
function bucketRunsByBand(runs: DocxTextRun[], bands: PageBand[]): DocxTextRun[][] {
  const buckets: DocxTextRun[][] = bands.map(() => [])
  if (bands.length === 0) return buckets
  for (const run of runs) {
    const middle = run.y + run.height / 2
    let index = bands.findIndex((band) => middle >= band.startPx && middle < band.endPx)
    if (index < 0) index = middle < bands[0].startPx ? 0 : bands.length - 1
    buckets[index].push(run)
  }
  return buckets
}

/**
 * Draw each word at its measured box with `opacity: 0` — the same mechanism the
 * OCR layer uses. The glyphs are never seen, so the embedded font only has to
 * carry the characters for extraction; Liberation Sans is used regardless of
 * what the page visually shows, because it is already bundled and is the one
 * face verified to survive `@pdf-lib/fontkit`.
 */
function drawInvisibleText(
  page: PDFPage,
  runs: DocxTextRun[],
  metrics: PageMetrics,
  band: PageBand,
  font: PDFFont,
  widthPt: number,
  heightPt: number,
): void {
  for (const run of runs) {
    const text = sanitizeAnnotationText(run.text)
    if (text.trim() === '') continue
    // Flow space → this page's space: the band's top is pulled to the top
    // margin, exactly as the stage does for the pixels.
    const yPx = metrics.marginTopPx + (run.y - band.startPx)
    const size = fitSize(text, font, run.height * PX_TO_PT, run.width * PX_TO_PT)
    page.drawText(text, {
      x: (metrics.marginLeftPx + run.x) * PX_TO_PT,
      // PDF y grows upward: the box's top-left becomes a baseline near its foot.
      y: heightPt - (yPx + run.height) * PX_TO_PT + size * 0.2,
      size,
      font,
      color: rgb(0, 0, 0),
      opacity: 0,
    })
  }
  void widthPt
}

/**
 * Size the invisible word to its *measured box*, not just to the line height.
 *
 * The visible pixels are whatever font the document asked for; the invisible
 * layer is always Liberation Sans, which is wider for the same nominal size. If
 * the drawn word is allowed to overflow its box it runs into the next one, and
 * a PDF reader — which infers word boundaries from geometry, not from draw
 * calls — then merges them ("Preparedfor"). Shrinking to fit restores the gaps
 * the layout actually had. Only ever shrinks: growing a short word to fill its
 * box would create the same overlap in the other direction.
 */
function fitSize(text: string, font: PDFFont, boxHeightPt: number, boxWidthPt: number): number {
  const size = Math.max(1, boxHeightPt * FONT_SIZE_RATIO)
  if (boxWidthPt <= 0) return size
  const naturalWidth = font.widthOfTextAtSize(text, size)
  if (naturalWidth <= boxWidthPt || naturalWidth <= 0) return size
  return Math.max(1, size * (boxWidthPt / naturalWidth))
}

async function embedTextLayerFont(document: PDFDocument): Promise<PDFFont> {
  const [{ default: fontkit }, fontBytes] = await Promise.all([
    import('@pdf-lib/fontkit'),
    fetchAnnotationFontBytes(),
  ])
  document.registerFontkit(fontkit)
  return document.embedFont(fontBytes, { subset: true })
}
