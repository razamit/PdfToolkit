/**
 * An .xlsx file is a ZIP of XML parts. This unpacks the parts the reader needs
 * as parsed XML documents, using `fflate` (already a dependency, used by the
 * split-to-ZIP export) and the platform `DOMParser` — so reading spreadsheets
 * adds no new dependency and no XML parser of our own.
 */

export type ZipEntries = Record<string, Uint8Array>

export async function unzipEntries(bytes: Uint8Array): Promise<ZipEntries> {
  const { unzipSync } = await import('fflate')
  return unzipSync(bytes)
}

const decoder = new TextDecoder()

/** Parse one ZIP entry as XML, or `null` when the part is absent or malformed. */
export function readXmlEntry(entries: ZipEntries, path: string): Document | null {
  const bytes = entries[path]
  if (!bytes) return null
  const document = new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml')
  // DOMParser reports failures as a `parsererror` element rather than throwing.
  return document.querySelector('parsererror') ? null : document
}

/**
 * Resolve an OPC relationship target against the part that declared it.
 * Targets are usually relative (`worksheets/sheet1.xml`) but may be absolute
 * (`/xl/worksheets/sheet1.xml`), and both must land on a real ZIP entry path.
 */
export function resolveRelationshipTarget(baseDirectory: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const segments = `${baseDirectory}/${target}`.split('/')
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') resolved.pop()
    else resolved.push(segment)
  }
  return resolved.join('/')
}

/** Map `Id` → resolved entry path for one `_rels` part. */
export function readRelationships(
  entries: ZipEntries,
  partPath: string,
): Map<string, string> {
  const directory = partPath.includes('/') ? partPath.slice(0, partPath.lastIndexOf('/')) : ''
  const relsPath = directory
    ? `${directory}/_rels/${partPath.slice(directory.length + 1)}.rels`
    : `_rels/${partPath}.rels`
  const document = readXmlEntry(entries, relsPath)
  const map = new Map<string, string>()
  if (!document) return map
  for (const node of document.getElementsByTagName('Relationship')) {
    const id = node.getAttribute('Id')
    const target = node.getAttribute('Target')
    if (id && target) map.set(id, resolveRelationshipTarget(directory, target))
  }
  return map
}
