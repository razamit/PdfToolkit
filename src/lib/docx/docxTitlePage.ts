import { unzipEntries } from '@/lib/sheets/xlsx/zipEntries'

/**
 * Recovers a section's *default* header and footer when it declares a distinct
 * first page.
 *
 * `<w:titlePg/>` tells Word to use one header on a section's first page and
 * another on the rest. docx-preview honours the flag by rendering the first-page
 * header — and only that one. The default header never enters the DOM, so a
 * converter that repeats the single rendered header puts "DRAFT" or a title-page
 * banner on every page of the document.
 *
 * There is no option to ask for both, so the document is rendered a second time
 * with the flag removed, which makes docx-preview emit the default header
 * instead. The second pass runs *only* when the flag is actually present, so
 * ordinary documents pay nothing.
 */

const TITLE_PAGE_PATTERN = /<w:titlePg\s*\/>|<w:titlePg\s*>[\s\S]*?<\/w:titlePg>/g

const DOCUMENT_PART = 'word/document.xml'

export async function hasTitlePage(bytes: Uint8Array): Promise<boolean> {
  const document = await readDocumentPart(bytes)
  return document !== null && TITLE_PAGE_PATTERN.test(document)
}

/**
 * The same document with every `titlePg` flag stripped. Returns `null` when
 * there was nothing to strip or the package could not be rewritten — callers
 * treat that as "no separate default chrome", which is the safe outcome.
 */
export async function withoutTitlePage(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const entries = await unzipEntries(bytes)
    const original = entries[DOCUMENT_PART]
    if (!original) return null
    const text = new TextDecoder().decode(original)
    const stripped = text.replace(TITLE_PAGE_PATTERN, '')
    if (stripped === text) return null

    const { zipSync } = await import('fflate')
    const rebuilt: Record<string, Uint8Array> = { ...entries }
    rebuilt[DOCUMENT_PART] = new TextEncoder().encode(stripped)
    return zipSync(rebuilt)
  } catch {
    return null
  }
}

async function readDocumentPart(bytes: Uint8Array): Promise<string | null> {
  try {
    const entries = await unzipEntries(bytes)
    const part = entries[DOCUMENT_PART]
    return part ? new TextDecoder().decode(part) : null
  } catch {
    return null
  }
}
