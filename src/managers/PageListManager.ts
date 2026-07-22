import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  NormalizedRect,
  PageDescriptor,
  Rotation,
  SignaturePlacement,
} from '@/domain/types'

/** Normalize any degree value into the 0/90/180/270 domain. */
export function normalizeRotation(degrees: number): Rotation {
  const wrapped = ((degrees % 360) + 360) % 360
  return wrapped as Rotation
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items
  const next = items.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/**
 * Pure transforms over the ordered page list. No side effects, no rendering,
 * no PDF knowledge — every method returns a new array, which keeps React state
 * updates predictable and makes the operations trivially testable.
 */
export const PageListManager = {
  append(pages: PageDescriptor[], added: PageDescriptor[]): PageDescriptor[] {
    return [...pages, ...added]
  },

  remove(pages: PageDescriptor[], ids: ReadonlySet<string>): PageDescriptor[] {
    return pages.filter((page) => !ids.has(page.id))
  },

  removeBySource(pages: PageDescriptor[], sourceId: string): PageDescriptor[] {
    return pages.filter((page) => page.sourceId !== sourceId)
  },

  rotate(pages: PageDescriptor[], ids: ReadonlySet<string>, delta: number): PageDescriptor[] {
    return pages.map((page) =>
      ids.has(page.id) ? { ...page, rotation: normalizeRotation(page.rotation + delta) } : page,
    )
  },

  move(pages: PageDescriptor[], fromIndex: number, toIndex: number): PageDescriptor[] {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= pages.length || toIndex >= pages.length) {
      return pages
    }
    return moveItem(pages, fromIndex, toIndex)
  },

  moveById(pages: PageDescriptor[], activeId: string, overId: string): PageDescriptor[] {
    const fromIndex = pages.findIndex((page) => page.id === activeId)
    const toIndex = pages.findIndex((page) => page.id === overId)
    if (fromIndex === -1 || toIndex === -1) return pages
    return moveItem(pages, fromIndex, toIndex)
  },

  addSignature(
    pages: PageDescriptor[],
    pageId: string,
    signature: SignaturePlacement,
  ): PageDescriptor[] {
    return pages.map((page) =>
      page.id === pageId
        ? { ...page, signatures: [...(page.signatures ?? []), signature] }
        : page,
    )
  },

  removeSignature(
    pages: PageDescriptor[],
    pageId: string,
    signatureId: string,
  ): PageDescriptor[] {
    return pages.map((page) => {
      if (page.id !== pageId || !page.signatures) return page
      const remaining = page.signatures.filter((signature) => signature.id !== signatureId)
      return { ...page, signatures: remaining.length > 0 ? remaining : undefined }
    })
  },

  addAnnotation(
    pages: PageDescriptor[],
    pageId: string,
    annotation: AnnotationPlacement,
  ): PageDescriptor[] {
    return pages.map((page) =>
      page.id === pageId
        ? { ...page, annotations: [...(page.annotations ?? []), annotation] }
        : page,
    )
  },

  removeAnnotation(
    pages: PageDescriptor[],
    pageId: string,
    annotationId: string,
  ): PageDescriptor[] {
    return pages.map((page) => {
      if (page.id !== pageId || !page.annotations) return page
      const remaining = page.annotations.filter((annotation) => annotation.id !== annotationId)
      return { ...page, annotations: remaining.length > 0 ? remaining : undefined }
    })
  },

  /** Replace a signature's rect (still expressed in its sign-time frame). */
  updateSignatureRect(
    pages: PageDescriptor[],
    pageId: string,
    signatureId: string,
    rect: NormalizedRect,
  ): PageDescriptor[] {
    return pages.map((page) => {
      if (page.id !== pageId || !page.signatures) return page
      return {
        ...page,
        signatures: page.signatures.map((signature) =>
          signature.id === signatureId ? { ...signature, rect } : signature,
        ),
      }
    })
  },

  /** Apply a move/resize patch to a text or image annotation (highlights are fixed). */
  updateAnnotationPlacement(
    pages: PageDescriptor[],
    pageId: string,
    annotationId: string,
    patch: AnnotationPlacementPatch,
  ): PageDescriptor[] {
    return pages.map((page) => {
      if (page.id !== pageId || !page.annotations) return page
      return {
        ...page,
        annotations: page.annotations.map((annotation) =>
          applyPlacementPatch(annotation, annotationId, patch),
        ),
      }
    })
  },
}

function applyPlacementPatch(
  annotation: AnnotationPlacement,
  annotationId: string,
  patch: AnnotationPlacementPatch,
): AnnotationPlacement {
  if (annotation.id !== annotationId || annotation.kind === 'highlight') return annotation
  if (annotation.kind === 'text') {
    return { ...annotation, rect: patch.rect, fontSizePt: patch.fontSizePt ?? annotation.fontSizePt }
  }
  return { ...annotation, rect: patch.rect }
}
