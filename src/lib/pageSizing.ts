import type { PageDescriptor, PageSizeMode, PageSizePreset } from '@/domain/types'

/**
 * Pure page-size math for the resize feature. All sizing is aspect-preserving:
 * a page is scaled by a single factor until it fits inside the target box, so
 * nothing is ever cropped or letterboxed and normalized placement rects stay
 * valid unchanged.
 */

/** Orientation-free page dimensions: the shorter and longer side in PDF points. */
export interface PageExtent {
  short: number
  long: number
}

/** ISO A4 in PDF points. */
const A4_EXTENT: PageExtent = { short: 595.28, long: 841.89 }

/** US Letter in PDF points. */
const LETTER_EXTENT: PageExtent = { short: 612, long: 792 }

/** Factors within 0.5% of 1 are treated as "already the right size". */
const NEAR_ORIGINAL_TOLERANCE = 0.005

export interface PageDimensions {
  width: number
  height: number
}

/** A4 portrait is the blank-page fallback when the working document has no paper-sized pages. */
export const DEFAULT_BLANK_PAGE_SIZE: PageDimensions = {
  width: A4_EXTENT.short,
  height: A4_EXTENT.long,
}

/**
 * Match a new blank to the most common non-image page box, preserving its
 * orientation. Images are pixel-sized rather than paper-sized and would make a
 * poor blank-page template; an image-only/empty document therefore gets A4.
 */
export function preferredBlankPageSize(pages: PageDescriptor[]): PageDimensions {
  const counts = new Map<string, { size: PageDimensions; count: number }>()
  for (const page of pages) {
    if (page.kind === 'image') continue
    const size = { width: page.width, height: page.height }
    const key = `${Math.round(size.width)}x${Math.round(size.height)}`
    const entry = counts.get(key) ?? { size, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  let preferred: { size: PageDimensions; count: number } | null = null
  for (const entry of counts.values()) {
    if (!preferred || entry.count > preferred.count) preferred = entry
  }
  return preferred?.size ?? DEFAULT_BLANK_PAGE_SIZE
}

export function pageExtent(page: Pick<PageDescriptor, 'width' | 'height'>): PageExtent {
  return {
    short: Math.min(page.width, page.height),
    long: Math.max(page.width, page.height),
  }
}

/**
 * Uniform factor that fits `page` inside `target` while keeping its aspect
 * ratio and orientation. Comparing short side to short side and long to long
 * makes the result rotation-independent, so portrait and landscape pages come
 * out at the same visual scale.
 */
export function fitScale(page: PageExtent, target: PageExtent): number {
  if (page.short <= 0 || page.long <= 0) return 1
  return Math.min(target.short / page.short, target.long / page.long)
}

/**
 * The document's prevailing page size: the most common extent among PDF pages.
 * Image pages are excluded — their pixel-sized boxes are what needs
 * normalizing. Image-only documents fall back to A4.
 */
export function dominantPageExtent(pages: PageDescriptor[]): PageExtent {
  const countsByRoundedExtent = new Map<string, { extent: PageExtent; count: number }>()
  for (const page of pages) {
    if (page.kind !== 'pdf') continue
    const extent = pageExtent(page)
    const key = `${Math.round(extent.short)}x${Math.round(extent.long)}`
    const entry = countsByRoundedExtent.get(key) ?? { extent, count: 0 }
    entry.count += 1
    countsByRoundedExtent.set(key, entry)
  }
  let dominant: { extent: PageExtent; count: number } | null = null
  for (const entry of countsByRoundedExtent.values()) {
    if (!dominant || entry.count > dominant.count) dominant = entry
  }
  return dominant?.extent ?? A4_EXTENT
}

export function resolveTargetExtent(preset: PageSizePreset, pages: PageDescriptor[]): PageExtent {
  if (preset === 'a4') return A4_EXTENT
  if (preset === 'letter') return LETTER_EXTENT
  return dominantPageExtent(pages)
}

/** Export factor for one page: an explicit per-page choice wins over the global target. */
export function exportScaleFor(page: PageDescriptor, targetExtent: PageExtent | null): number {
  if (page.exportScale !== undefined) return page.exportScale
  if (!targetExtent) return 1
  return fitScale(pageExtent(page), targetExtent)
}

/** Set (or clear, for 'original') the export scale of the given pages against a preset. */
export function resizePagesToPreset(
  pages: PageDescriptor[],
  ids: ReadonlySet<string>,
  preset: PageSizeMode,
): PageDescriptor[] {
  const target = preset === 'original' ? null : resolveTargetExtent(preset, pages)
  return pages.map((page) => {
    if (!ids.has(page.id)) return page
    if (!target) return { ...page, exportScale: undefined }
    const factor = fitScale(pageExtent(page), target)
    const isNearOriginal = Math.abs(factor - 1) < NEAR_ORIGINAL_TOLERANCE
    return { ...page, exportScale: isNearOriginal ? undefined : factor }
  })
}
