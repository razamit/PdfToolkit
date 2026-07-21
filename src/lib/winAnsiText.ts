/**
 * WinAnsi (CP1252) sanitization for annotation text. pdf-lib's standard fonts
 * (Helvetica) can only encode WinAnsi; any other character makes `drawText`
 * throw at export, so unsupported characters are stripped at input time.
 */

/** Code points 0x80–0x9F remapped by CP1252 (€ ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ). */
const CP1252_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

function isWinAnsiCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return CP1252_EXTRAS.has(codePoint)
}

/** Strip characters Helvetica can't encode. Newlines survive; other control characters don't. */
export function sanitizeWinAnsiText(text: string): string {
  let result = ''
  for (const char of text) {
    if (char === '\n' || isWinAnsiCodePoint(char.codePointAt(0) ?? 0)) result += char
  }
  return result
}
