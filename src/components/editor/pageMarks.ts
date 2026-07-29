import type { AnnotationPlacement, PageDescriptor } from '@/domain/types'

export type PageMarkKind = 'signature' | 'text' | 'image' | 'highlight' | 'freehand-highlight'

/** One row of the items list: a signature or an annotation placed on the page. */
export interface PageMark {
  id: string
  kind: PageMarkKind
  /** Which array it lives in — decides which removal call applies. */
  source: 'signature' | 'annotation'
  /** Row title: the typed text for a text mark, otherwise its kind's name. */
  title: string
  /** The mark's own colour, shown as a dot on the row (absent when it has none). */
  colorHex?: string
}

const KIND_LABELS: Record<PageMarkKind, string> = {
  signature: 'Signature',
  text: 'Text',
  image: 'Image',
  highlight: 'Highlight',
  'freehand-highlight': 'Highlight',
}

export function markKindLabel(kind: PageMarkKind): string {
  return KIND_LABELS[kind]
}

/**
 * Everything on a page, in the order the overlays stack it: signatures first,
 * then annotations, each group in the order it was added.
 *
 * Stacking order rather than true add-order because nothing records when a
 * mark was made and the two arrays are separate — interleaving them would be a
 * guess. Within a kind (several text boxes, the common case) it *is* add-order,
 * and the row icon names the kind, so the grouping reads as a grouping rather
 * than as a scrambled history.
 */
export function describePageMarks(page: PageDescriptor): PageMark[] {
  const signatures: PageMark[] = (page.signatures ?? []).map((signature) => ({
    id: signature.id,
    kind: 'signature',
    source: 'signature',
    title: KIND_LABELS.signature,
  }))
  const annotations = (page.annotations ?? []).map(describeAnnotation)
  return [...signatures, ...annotations]
}

function describeAnnotation(annotation: AnnotationPlacement): PageMark {
  const base = { id: annotation.id, source: 'annotation' as const, kind: annotation.kind }
  switch (annotation.kind) {
    case 'text':
      return { ...base, title: firstLine(annotation.text) || KIND_LABELS.text }
    case 'image':
      return { ...base, title: KIND_LABELS.image }
    default:
      return { ...base, title: KIND_LABELS[annotation.kind], colorHex: annotation.colorHex }
  }
}

/** Text annotations are multi-line; a row shows the first line and CSS clips it. */
function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}
