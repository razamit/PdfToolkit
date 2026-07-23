import {
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib'
import { normalizeRotation } from '@/managers/PageListManager'
import { fetchAnnotationFontBytes } from '@/lib/annotationFont'
import { textNeedsUnicodeFont } from '@/lib/annotationText'
import { exportSurfaceSize, renderStrokesToPng } from '@/lib/strokeRendering'
import { stampTextAnnotation } from './TextStamper'
import { stampImageAnnotation } from './ImageStamper'
import { stampHighlightAnnotation } from './HighlightStamper'
import { stampFreehandHighlightAnnotation } from './FreehandHighlightStamper'
import type {
  AnnotationPlacement,
  FreehandHighlightPlacement,
  ImagePlacement,
  Rotation,
} from '@/domain/types'

/**
 * Stamps text/image/highlight/free-hand-highlight annotations onto exported
 * pages. Drawing math lives in the per-kind stampers; this facade owns the
 * pdf-lib resources shared across a run: the fonts and each unique embedded
 * image (including the rasterized free-hand ink PNGs). WinAnsi-only text uses
 * standard Helvetica; anything else (Hebrew) embeds the bundled Unicode font,
 * subset to the glyphs actually used.
 */
export class AnnotationStamper {
  private readonly out: PDFDocument
  private helvetica: PDFFont | null = null
  private unicodeFont: Promise<PDFFont> | null = null
  private readonly embeddedImages = new Map<string, PDFImage>()

  constructor(out: PDFDocument) {
    this.out = out
  }

  /**
   * Draw annotations onto `page`. `intrinsicRotation` is the page's `/Rotate`
   * angle before the user's rotation was applied; each placement composes it
   * with the user rotation frozen at creation time.
   */
  async stampAll(
    page: PDFPage,
    annotations: AnnotationPlacement[],
    intrinsicRotation: number,
  ): Promise<void> {
    for (const annotation of annotations) {
      const totalRotation = normalizeRotation(intrinsicRotation + annotation.rotationAtCreate)
      switch (annotation.kind) {
        case 'text':
          stampTextAnnotation(page, annotation, totalRotation, await this.fontFor(annotation.text))
          break
        case 'image':
          stampImageAnnotation(page, annotation, totalRotation, await this.embedImage(annotation))
          break
        case 'highlight':
          stampHighlightAnnotation(page, annotation, totalRotation)
          break
        case 'freehand-highlight':
          await this.stampFreehandHighlight(page, annotation, totalRotation)
          break
      }
    }
  }

  /**
   * Rasterize a free-hand highlight's strokes to a flat-colour transparent PNG
   * cropped to its bbox, then stamp it with Multiply. The raster surface takes
   * the displayed page aspect (cropBox dims swapped when sideways) so the
   * strokes keep their proportions, and the line width is the placement's
   * thickness fraction of the surface's smaller side — the same relative width
   * the on-screen SVG uses, so preview and export match.
   */
  private async stampFreehandHighlight(
    page: PDFPage,
    placement: FreehandHighlightPlacement,
    totalRotation: Rotation,
  ): Promise<void> {
    const cropBox = page.getCropBox()
    const sideways = totalRotation === 90 || totalRotation === 270
    const displayedWidth = sideways ? cropBox.height : cropBox.width
    const displayedHeight = sideways ? cropBox.width : cropBox.height
    const aspect = displayedWidth / displayedHeight
    const surface = exportSurfaceSize(aspect)
    const lineWidth = placement.thickness * Math.min(surface.width, surface.height)
    const rendered = renderStrokesToPng(placement.strokes, aspect, {
      color: placement.colorHex,
      lineWidth,
    })
    if (!rendered) return
    const image = await this.embedPngDataUrl(rendered.dataUrl)
    stampFreehandHighlightAnnotation(page, rendered.bbox, totalRotation, image)
  }

  private async fontFor(text: string): Promise<PDFFont> {
    return textNeedsUnicodeFont(text) ? this.getUnicodeFont() : this.getHelvetica()
  }

  private getHelvetica(): PDFFont {
    if (!this.helvetica) this.helvetica = this.out.embedStandardFont(StandardFonts.Helvetica)
    return this.helvetica
  }

  private getUnicodeFont(): Promise<PDFFont> {
    if (!this.unicodeFont) this.unicodeFont = this.embedUnicodeFont()
    return this.unicodeFont
  }

  private async embedUnicodeFont(): Promise<PDFFont> {
    // fontkit is only pulled into the bundle when a Unicode annotation exists.
    const [{ default: fontkit }, fontBytes] = await Promise.all([
      import('@pdf-lib/fontkit'),
      fetchAnnotationFontBytes(),
    ])
    this.out.registerFontkit(fontkit)
    return this.out.embedFont(fontBytes, { subset: true })
  }

  private async embedImage(placement: ImagePlacement): Promise<PDFImage> {
    if (placement.format === 'jpeg') {
      const cached = this.embeddedImages.get(placement.dataUrl)
      if (cached) return cached
      const image = await this.out.embedJpg(placement.dataUrl)
      this.embeddedImages.set(placement.dataUrl, image)
      return image
    }
    return this.embedPngDataUrl(placement.dataUrl)
  }

  /** Embed a PNG data URL once, cached by its data URL (shared with freehand marks). */
  private async embedPngDataUrl(dataUrl: string): Promise<PDFImage> {
    const cached = this.embeddedImages.get(dataUrl)
    if (cached) return cached
    const image = await this.out.embedPng(dataUrl)
    this.embeddedImages.set(dataUrl, image)
    return image
  }
}
