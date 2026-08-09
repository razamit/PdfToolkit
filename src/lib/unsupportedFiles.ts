/**
 * Turns "this file is an Office document" into the one instruction that
 * actually solves it.
 *
 * This app deliberately does not convert Office files. The application that
 * owns the format — Word, PowerPoint, Excel, Pages, Keynote — can already
 * export a PDF with its own layout engine and the real fonts, and that output
 * is better than any in-browser conversion can be. So the honest answer to a
 * dropped `.docx` is not "unsupported file", which reads as a dead end, but the
 * route that gets a better result than a converter would have. See decision
 * row 41 in `docs/DECISIONS.md`.
 *
 * Extensions only — a MIME check would add nothing, because these arrive from
 * drag-and-drop where the browser often reports nothing at all.
 */

const OFFICE_EXTENSIONS = [
  '.doc',
  '.docx',
  '.dot',
  '.dotx',
  '.rtf',
  '.odt',
  '.pages',
  '.ppt',
  '.pptx',
  '.pps',
  '.ppsx',
  '.potx',
  '.odp',
  '.key',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.csv',
  '.tsv',
  '.ods',
  '.numbers',
]

/**
 * A message naming the fix, or `null` when the file is not an Office document
 * and the generic rejection should stand.
 */
export function officeFileAdvice(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!OFFICE_EXTENSIONS.some((extension) => name.endsWith(extension))) return null
  return `"${file.name}" is an Office file. Open it in the app that made it and choose File → Print → Save as PDF (or Export as PDF), then add that PDF here — it will look exactly right.`
}
