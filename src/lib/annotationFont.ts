import { textNeedsUnicodeFont } from './annotationText'

/**
 * The bundled Unicode annotation font: Liberation Sans Regular (SIL OFL,
 * license next to the file). Liberation Sans is metric-compatible with
 * Arial/Helvetica and covers Latin, Hebrew, and ₪ — the editor previews with
 * the exact file the export embeds, so the preview is glyph-for-glyph what
 * the PDF will show.
 */
export const ANNOTATION_FONT_URL = '/fonts/LiberationSans-Regular.ttf'

/** Must match the `@font-face` family registered in `index.css`. */
const UNICODE_FONT_CSS_STACK = "'Liberation Sans Annotation', Helvetica, Arial, sans-serif"

/** CSS stack matching the standard-Helvetica export path for WinAnsi-only text. */
const HELVETICA_CSS_STACK = 'Helvetica, Arial, sans-serif'

/** The preview stack matching the font the export will actually use for this text. */
export function annotationFontFamilyFor(text: string): string {
  return textNeedsUnicodeFont(text) ? UNICODE_FONT_CSS_STACK : HELVETICA_CSS_STACK
}

let cachedFontBytes: Promise<ArrayBuffer> | null = null

/** Fetch the annotation font once per session for pdf-lib embedding. */
export function fetchAnnotationFontBytes(): Promise<ArrayBuffer> {
  if (!cachedFontBytes) {
    cachedFontBytes = fetch(ANNOTATION_FONT_URL).then((response) => {
      if (!response.ok) throw new Error('The annotation font could not be loaded for export.')
      return response.arrayBuffer()
    })
    // A failed fetch shouldn't poison every later export — allow a retry.
    cachedFontBytes.catch(() => {
      cachedFontBytes = null
    })
  }
  return cachedFontBytes
}
