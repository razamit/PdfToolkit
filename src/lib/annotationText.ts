/**
 * Character support for annotation text. WinAnsi (CP1252) text exports with
 * pdf-lib's standard Helvetica; Hebrew (plus ₪) needs the bundled Unicode
 * font instead. Characters outside both sets are stripped at input time so
 * `drawText` can never throw at export.
 */

/** Code points 0x80–0x9F remapped by CP1252 (€ ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ). */
const CP1252_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

const SHEQEL_SIGN = 0x20aa

export function isWinAnsiCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return CP1252_EXTRAS.has(codePoint)
}

/**
 * Hebrew code points the bundled font has glyphs for: cantillation and niqqud
 * marks, letters, and ligatures/geresh — not the block's unassigned slots.
 */
function isHebrewCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x0591 && codePoint <= 0x05c7) return true
  if (codePoint >= 0x05d0 && codePoint <= 0x05ea) return true
  return codePoint >= 0x05f0 && codePoint <= 0x05f4
}

function isSupportedCodePoint(codePoint: number): boolean {
  return isWinAnsiCodePoint(codePoint) || isHebrewCodePoint(codePoint) || codePoint === SHEQEL_SIGN
}

/** Strip characters no export font can draw. Newlines survive; other control characters don't. */
export function sanitizeAnnotationText(text: string): string {
  let result = ''
  for (const char of text) {
    if (char === '\n' || isSupportedCodePoint(char.codePointAt(0) ?? 0)) result += char
  }
  return result
}

/** True when standard Helvetica can't encode the text and the Unicode font must be embedded. */
export function textNeedsUnicodeFont(text: string): boolean {
  for (const char of text) {
    if (char !== '\n' && !isWinAnsiCodePoint(char.codePointAt(0) ?? 0)) return true
  }
  return false
}

export type BaseDirection = 'ltr' | 'rtl'

/** Strong left-to-right letters within the supported set (ASCII, Latin-1, CP1252 extras). */
const STRONG_LTR_PATTERN = /[A-Za-zªºÀ-ÖØ-öø-ÿŒ-žƒ]/

/**
 * First-strong-character paragraph direction — the same heuristic the browser
 * uses for `dir="auto"`, so the exported alignment matches the editor.
 */
export function detectBaseDirection(text: string): BaseDirection {
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0
    if (isHebrewCodePoint(codePoint)) return 'rtl'
    if (STRONG_LTR_PATTERN.test(char)) return 'ltr'
  }
  return 'ltr'
}
