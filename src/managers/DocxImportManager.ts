import { PDFDocument, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import { fetchAnnotationFontBytes } from '@/lib/annotationFont'
import { sanitizeAnnotationText } from '@/lib/annotationText'
import { loadDocxSubstituteFonts } from '@/lib/docx/docxFonts'
import { computePageBands, type PageBand, type PageMetrics } from '@/lib/docx/docxPaginate'
import { rasterizePage } from '@/lib/docx/docxRasterize'
import { readPageMetrics, renderDocx, splitPageParts } from '@/lib/docx/docxRender'
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

    const rendered = await this.render(file)
    try {
      if (rendered.pages.length === 0) {
        throw new SourceLoadError(`"${file.name}" has no pages to convert.`)
      }
      const document = await PDFDocument.create()
      document.setTitle(file.name)
      const font = await embedTextLayerFont(document)

      // Each rendered element is one *section*; a section may still be many
      // pages long, so every one of them is paginated in turn.
      for (const section of rendered.pages) {
        await this.addSection(document, section, font)
      }
      return document.save()
    } finally {
      rendered.host.remove()
    }
  }

  private async render(file: File): Promise<Awaited<ReturnType<typeof renderDocx>>> {
    try {
      return await renderDocx(new Uint8Array(await file.arrayBuffer()))
    } catch {
      throw new SourceLoadError(
        `"${file.name}" could not be opened — it may be corrupted, password-protected, or not a real .docx file.`,
      )
    }
  }

  private async addSection(
    document: PDFDocument,
    section: HTMLElement,
    font: PDFFont,
  ): Promise<void> {
    // Page geometry comes from the section, which is not moved.
    const metrics = readPageMetrics(section)
    const { flowed, header, footer } = splitPageParts(section)
    if (!flowed) return

    const host = section.parentElement ?? section
    const stage = createStage(host, flowed, metrics, header, footer)
    try {
      // Everything else is measured *after* staging, in the flowed element's own
      // space. Measuring beforehand looks equivalent and is not: moving the
      // element changes margin collapsing, so bands computed from the old
      // geometry sit a few pixels off the lines they were meant to fall between,
      // and every page break shaves a sliver off the next page.
      const runs = extractTextRuns(flowed)
      const bandHeight = metrics.pageHeightPx - metrics.marginTopPx - metrics.marginBottomPx
      const bands = computePageBands(
        bandHeight,
        flowed.getBoundingClientRect().height,
        extractUnbreakableBoxes(flowed, runs),
      )
      for (const band of bands) {
        stage.show(band)
        await this.addPage(document, stage.element, metrics, band, runs, font)
      }
    } finally {
      stage.dispose()
    }
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
    drawInvisibleText(page, runsForBand(runs, band), metrics, band, font, widthPt, heightPt)
  }
}

/**
 * Words wholly inside the band. A word straddling the break is dropped rather
 * than duplicated onto both pages: the break was already chosen to avoid
 * cutting lines, so anything still straddling is an oversized object the reader
 * can see in the raster regardless.
 */
function runsForBand(runs: DocxTextRun[], band: PageBand): DocxTextRun[] {
  return runs.filter((run) => run.y >= band.startPx - 0.5 && run.y + run.height <= band.endPx + 0.5)
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
