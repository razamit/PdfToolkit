/**
 * Loads the metric-compatible substitutes a Word document expects.
 *
 * This is the single largest fidelity lever in the whole conversion, and it is
 * easy to underrate: a `.docx` names Calibri or Cambria, neither is installed,
 * and the browser silently falls back to a default serif. The text is all still
 * there — it simply breaks in different places than Word broke it, which is the
 * one thing a "convert my document" feature must not do.
 *
 * Carlito and Caladea are metric-compatible with Calibri and Cambria: same
 * advance widths, so lines wrap where Word wrapped them. Arial and Helvetica
 * are already served by the bundled Liberation Sans.
 *
 * Loaded on demand rather than at startup — a visitor who never converts a Word
 * file should never pay for ~2.6 MB of fonts. The service worker's `cacheFirst`
 * handler keeps them after the first use.
 */

const FONT_BASE = '/fonts/docx'

interface SubstituteFace {
  /** The family this is registered as — the name the document actually asks for. */
  family: string
  file: string
  weight: 400 | 700
  style: 'normal' | 'italic'
}

/**
 * Each substitute is registered under the *original* family name, so
 * docx-preview's emitted `font-family: Calibri` resolves to Carlito with no
 * rewriting of the rendered CSS. "Calibri Light" is mapped to Carlito Regular
 * because no lighter cut exists; a heading is then very slightly heavy rather
 * than a different typeface altogether.
 */
const FACES: SubstituteFace[] = [
  { family: 'Calibri', file: 'Carlito-Regular', weight: 400, style: 'normal' },
  { family: 'Calibri', file: 'Carlito-Bold', weight: 700, style: 'normal' },
  { family: 'Calibri', file: 'Carlito-Italic', weight: 400, style: 'italic' },
  { family: 'Calibri', file: 'Carlito-BoldItalic', weight: 700, style: 'italic' },
  { family: 'Calibri Light', file: 'Carlito-Regular', weight: 400, style: 'normal' },
  { family: 'Calibri Light', file: 'Carlito-Italic', weight: 400, style: 'italic' },
  { family: 'Carlito', file: 'Carlito-Regular', weight: 400, style: 'normal' },
  { family: 'Carlito', file: 'Carlito-Bold', weight: 700, style: 'normal' },
  { family: 'Cambria', file: 'Caladea-Regular', weight: 400, style: 'normal' },
  { family: 'Cambria', file: 'Caladea-Bold', weight: 700, style: 'normal' },
  { family: 'Cambria', file: 'Caladea-Italic', weight: 400, style: 'italic' },
  { family: 'Cambria', file: 'Caladea-BoldItalic', weight: 700, style: 'italic' },
  { family: 'Caladea', file: 'Caladea-Regular', weight: 400, style: 'normal' },
]

let loaded: Promise<void> | null = null

/**
 * Register and fully load every substitute. Awaiting the *load* (not just the
 * registration) is essential: rasterizing while a face is still arriving
 * captures the fallback glyphs, which is the classic silent failure of
 * DOM-to-image capture and would look like a fidelity bug rather than a race.
 */
export function loadDocxSubstituteFonts(): Promise<void> {
  if (!loaded) {
    loaded = registerAll().catch((error) => {
      // A failed font load must not fail the conversion — the document still
      // renders with fallbacks, just with different line breaks. Allow a retry.
      loaded = null
      throw error
    })
  }
  return loaded
}

async function registerAll(): Promise<void> {
  const faces = FACES.map((face) => {
    const descriptor = new FontFace(
      face.family,
      `url("${FONT_BASE}/${face.file}.ttf") format("truetype")`,
      { weight: String(face.weight), style: face.style, display: 'block' },
    )
    document.fonts.add(descriptor)
    return descriptor.load()
  })
  const results = await Promise.allSettled(faces)
  // Partial success is fine and worth continuing on: a document that only uses
  // Calibri does not care that a Caladea cut failed to arrive.
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error('The document substitution fonts could not be loaded.')
  }
}

/** True once the browser reports every registered face as usable. */
export function substituteFontsReady(): Promise<FontFaceSet> {
  return document.fonts.ready
}
