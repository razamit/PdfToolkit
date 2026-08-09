import { unzipEntries, readXmlEntry } from '@/lib/sheets/xlsx/zipEntries'

/**
 * Fills in `PAGE` and `NUMPAGES` fields in headers and footers.
 *
 * docx-preview does not evaluate fields. It drops the field runs entirely, so a
 * footer whose Word content is `Page {PAGE} of {NUMPAGES}` renders as
 * `<span>Page </span><span> of </span>` — the numbers are absent, and there is
 * no placeholder element to write into. A footer reading "Page  of " looks like
 * a broken converter rather than a limitation, and page numbers are close to
 * universal in business documents.
 *
 * The converter is the one component that can resolve them: it knows a page's
 * index and, once every section is paginated, the total. What it does not know
 * from the DOM alone is *where* the numbers belong — so the source XML is read
 * to learn each field's position among the literal text runs, and the value is
 * inserted at the matching point in the rendered element.
 */

export type FieldKind = 'PAGE' | 'NUMPAGES'

interface PlannedField {
  kind: FieldKind
  /** How many rendered text runs precede this field. */
  afterRunIndex: number
  /** Indices of runs holding Word's cached value, which must be replaced. */
  resultRunIndices: number[]
}

export interface FieldPlan {
  /** Literal text of each rendered run, used to match a plan to an element. */
  signature: string[]
  fields: PlannedField[]
}

const CHROME_PART = /^word\/(header|footer)\d*\.xml$/

/** Read a field plan for every header and footer part in the package. */
export async function readFieldPlans(bytes: Uint8Array): Promise<FieldPlan[]> {
  try {
    const entries = await unzipEntries(bytes)
    const plans: FieldPlan[] = []
    for (const path of Object.keys(entries)) {
      if (!CHROME_PART.test(path)) continue
      const document = readXmlEntry(entries, path)
      if (!document) continue
      const plan = planFor(document)
      if (plan.fields.length > 0) plans.push(plan)
    }
    return plans
  } catch {
    return []
  }
}

/**
 * Walk the part's runs in order, tracking field boundaries. A field is a
 * `begin` marker, an instruction, an optional `separate` followed by Word's
 * cached result, and an `end` marker. Only runs carrying `<w:t>` become
 * rendered text, so only those advance the index the DOM is matched against.
 */
function planFor(document: Document): FieldPlan {
  const signature: string[] = []
  const fields: PlannedField[] = []
  let open: OpenField | null = null

  const close = () => {
    if (open?.kind) {
      fields.push({ kind: open.kind, afterRunIndex: open.at, resultRunIndices: open.resultRunIndices })
    }
    open = null
  }

  for (const run of Array.from(document.getElementsByTagName('w:r'))) {
    // A run may carry several of these at once. Well-formed Word output splits
    // begin / instruction / result / end across separate runs, but generators
    // routinely collapse them, and one that emits no `end` at all must not
    // swallow the field — so each marker is handled independently rather than
    // as a state machine that assumes the canonical shape.
    const markers = Array.from(run.getElementsByTagName('w:fldChar')).map((node) =>
      node.getAttribute('w:fldCharType'),
    )
    if (markers.includes('begin')) {
      close()
      open = { kind: null, inResult: false, resultRunIndices: [], at: signature.length }
    }

    const instruction = run.getElementsByTagName('w:instrText')[0]?.textContent ?? ''
    if (open && instruction.trim() !== '') {
      if (/\bNUMPAGES\b/i.test(instruction)) open.kind = 'NUMPAGES'
      else if (/\bPAGE\b/i.test(instruction)) open.kind = 'PAGE'
    }

    if (markers.includes('separate') && open) open.inResult = true

    // Instruction runs carry `<w:instrText>`, not `<w:t>`, so they never render
    // and never advance the index the DOM is matched against.
    if (instruction.trim() === '') {
      const texts = Array.from(run.getElementsByTagName('w:t'))
      if (texts.length > 0) {
        let text = ''
        for (const node of texts) text += node.textContent ?? ''
        if (open?.inResult) open.resultRunIndices.push(signature.length)
        signature.push(text)
      }
    }

    if (markers.includes('end')) close()
  }
  // A field left open by a missing `end` is still a field the reader expects.
  close()
  return { signature, fields }
}

interface OpenField {
  kind: FieldKind | null
  inResult: boolean
  resultRunIndices: number[]
  at: number
}

/**
 * Write `pageNumber` / `totalPages` into a rendered header or footer.
 *
 * Matching is by text signature rather than by relationship id: the element may
 * be a clone (the default header recovered for a title-page section), and a
 * clone carries no link back to the part it came from. Two chrome parts with
 * identical literal text would carry identical plans anyway, so a collision is
 * harmless.
 */
export function applyFields(
  element: HTMLElement,
  plans: FieldPlan[],
  pageNumber: number,
  totalPages: number,
): void {
  const spans = renderedRuns(element)
  const plan = plans.find((candidate) => matches(candidate, spans))
  if (!plan) return

  // Applied back-to-front so inserting a value cannot shift the index of a
  // field that has not been placed yet.
  for (const field of [...plan.fields].reverse()) {
    const value = field.kind === 'PAGE' ? String(pageNumber) : String(totalPages)
    if (field.resultRunIndices.length > 0) {
      // Word cached a value here; overwrite it rather than adding a second one.
      field.resultRunIndices.forEach((index, position) => {
        const node = spans[index]
        if (node) node.textContent = position === 0 ? value : ''
      })
      continue
    }
    insertValue(element, spans, field.afterRunIndex, value)
  }
}

/** Elements holding the part's literal text, in document order. */
function renderedRuns(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('span')).filter(
    (span) => span.children.length === 0,
  )
}

/**
 * Compare only the runs this plan does not itself rewrite.
 *
 * Runs holding a field's cached value are skipped, because writing page 1's
 * number into them changes the very text a full comparison would match against
 * — so page 2 would find no plan and silently keep page 1's number.
 */
function matches(plan: FieldPlan, spans: HTMLElement[]): boolean {
  if (plan.signature.length !== spans.length) return false
  const rewritten = new Set(plan.fields.flatMap((field) => field.resultRunIndices))
  return plan.signature.every(
    (text, index) => rewritten.has(index) || text === (spans[index].textContent ?? ''),
  )
}

function insertValue(
  element: HTMLElement,
  spans: HTMLElement[],
  afterRunIndex: number,
  value: string,
): void {
  const holder = document.createElement('span')
  holder.dataset.docxField = 'true'
  holder.textContent = value
  const previous = spans[afterRunIndex - 1]
  if (previous?.parentNode) {
    previous.parentNode.insertBefore(holder, previous.nextSibling)
    return
  }
  const next = spans[afterRunIndex]
  if (next?.parentNode) {
    next.parentNode.insertBefore(holder, next)
    return
  }
  element.appendChild(holder)
}

/** Remove values written by a previous page so the element can be reused. */
export function clearFields(element: HTMLElement): void {
  for (const node of Array.from(element.querySelectorAll('[data-docx-field]'))) node.remove()
}
