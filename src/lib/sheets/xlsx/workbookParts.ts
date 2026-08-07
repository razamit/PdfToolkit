import type { CellFormat } from './numberFormat'
import { readRelationships, readXmlEntry, type ZipEntries } from './zipEntries'

/**
 * The three workbook-level parts every worksheet read depends on: the shared
 * string pool, the style table that says which cells are dates, and the sheet
 * list that names them and points at their parts.
 */

/** Concatenated text of an `<si>` or `<is>`, joining rich-text `<r><t>` runs. */
export function readStringItem(node: Element): string {
  const texts = node.getElementsByTagName('t')
  let result = ''
  for (const text of texts) result += text.textContent ?? ''
  return result
}

export function readSharedStrings(entries: ZipEntries): string[] {
  const document = readXmlEntry(entries, 'xl/sharedStrings.xml')
  if (!document) return []
  return Array.from(document.getElementsByTagName('si'), readStringItem)
}

/**
 * Style index → number format. A cell's `s` attribute indexes `cellXfs`, whose
 * entry carries a `numFmtId`; ids below 164 are built in and carry no code,
 * higher ids are defined by a `numFmt` element in the same part.
 */
export function readCellFormats(entries: ZipEntries): CellFormat[] {
  const document = readXmlEntry(entries, 'xl/styles.xml')
  if (!document) return []

  // Scoped to the `numFmts` container on purpose: `dxfs` (conditional-format
  // overrides) contains its own `numFmt` elements, and reading the whole part
  // would let one of those overwrite a real column's format.
  const codesById = new Map<number, string>()
  const numberFormats = document.getElementsByTagName('numFmts')[0]
  for (const node of numberFormats?.getElementsByTagName('numFmt') ?? []) {
    const id = Number(node.getAttribute('numFmtId'))
    const code = node.getAttribute('formatCode')
    if (Number.isFinite(id) && code !== null) codesById.set(id, code)
  }

  const cellXfs = document.getElementsByTagName('cellXfs')[0]
  if (!cellXfs) return []
  return Array.from(cellXfs.getElementsByTagName('xf'), (node) => {
    const numberFormatId = Number(node.getAttribute('numFmtId') ?? 0)
    return {
      numberFormatId: Number.isFinite(numberFormatId) ? numberFormatId : 0,
      code: codesById.get(numberFormatId) ?? '',
    }
  })
}

export interface WorkbookSheet {
  name: string
  /** ZIP entry path of the worksheet part. */
  path: string
}

export interface WorkbookInfo {
  sheets: WorkbookSheet[]
  /** Workbooks authored on classic Mac Excel count days from 1904, not 1900. */
  use1904Epoch: boolean
}

const WORKBOOK_PATH = 'xl/workbook.xml'
const RELATIONSHIP_ID_ATTRIBUTE = 'r:id'

export function readWorkbookInfo(entries: ZipEntries): WorkbookInfo | null {
  const document = readXmlEntry(entries, WORKBOOK_PATH)
  if (!document) return null
  const relationships = readRelationships(entries, WORKBOOK_PATH)

  const sheets: WorkbookSheet[] = []
  for (const node of document.getElementsByTagName('sheet')) {
    if (isHiddenSheet(node)) continue
    const path = sheetPath(node, relationships)
    if (path && entries[path]) {
      sheets.push({ name: node.getAttribute('name') ?? `Sheet ${sheets.length + 1}`, path })
    }
  }

  return { sheets, use1904Epoch: readDate1904Flag(document) }
}

/**
 * Hidden sheets are skipped: they hold lookup tables and scratch calculations
 * the author chose not to show, so printing them would add pages of context-free
 * data to a document meant to reproduce what the spreadsheet displays.
 */
function isHiddenSheet(node: Element): boolean {
  const state = node.getAttribute('state')
  return state === 'hidden' || state === 'veryHidden'
}

function sheetPath(node: Element, relationships: Map<string, string>): string | null {
  // The namespace prefix is conventionally `r:` but is not guaranteed, so fall
  // back to a local-name lookup before giving up on the relationship.
  const id =
    node.getAttribute(RELATIONSHIP_ID_ATTRIBUTE) ??
    node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  if (!id) return null
  return relationships.get(id) ?? null
}

function readDate1904Flag(document: Document): boolean {
  const properties = document.getElementsByTagName('workbookPr')[0]
  const value = properties?.getAttribute('date1904') ?? properties?.getAttribute('dateCompatibility')
  return value === '1' || value === 'true'
}
