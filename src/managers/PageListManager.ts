import type { PageDescriptor, Rotation } from '@/domain/types'

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
}
