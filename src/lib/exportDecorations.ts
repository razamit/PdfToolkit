import type {
  ExportDecorations,
  NormalizedRect,
  PageDescriptor,
  TextPlacement,
} from '@/domain/types'
import { cropRectForFrame } from '@/lib/cropGeometry'
import { mapRectWithin } from '@/lib/signatureGeometry'

/** Build transient text placements for one page. They are stamped but never added to editor state. */
export function decorationsForPage(
  page: PageDescriptor,
  pageIndex: number,
  totalPages: number,
  options: ExportDecorations,
): TextPlacement[] {
  const visible = cropRectForFrame(page.crop, page.rotation)
  const placements: TextPlacement[] = []

  if (options.watermark.enabled && options.watermark.text.trim()) {
    placements.push({
      id: `export-watermark-${page.id}`,
      kind: 'text',
      text: options.watermark.text.trim(),
      rect: mapRectWithin(visible, { x: 0.08, y: 0.44, width: 0.84, height: 0.12 }),
      rotationAtCreate: page.rotation,
      fontSizePt: options.watermark.fontSizePt,
      colorHex: options.watermark.colorHex,
      opacity: options.watermark.opacity,
      textAlign: 'center',
    })
  }

  if (options.pageNumbers.enabled) {
    const number = options.pageNumbers.startAt + pageIndex
    const text =
      options.pageNumbers.format === 'page-of-total'
        ? `Page ${number} of ${options.pageNumbers.startAt + totalPages - 1}`
        : String(number)
    const horizontal = pageNumberHorizontalRect(options.pageNumbers.position)
    placements.push({
      id: `export-page-number-${page.id}`,
      kind: 'text',
      text,
      rect: mapRectWithin(visible, horizontal),
      rotationAtCreate: page.rotation,
      fontSizePt: options.pageNumbers.fontSizePt,
      colorHex: options.pageNumbers.colorHex,
      textAlign:
        options.pageNumbers.position === 'bottom-left'
          ? 'left'
          : options.pageNumbers.position === 'bottom-right'
            ? 'right'
            : 'center',
    })
  }

  return placements
}

function pageNumberHorizontalRect(position: ExportDecorations['pageNumbers']['position']): NormalizedRect {
  switch (position) {
    case 'bottom-left':
      return { x: 0.04, y: 0.95, width: 0.28, height: 0.04 }
    case 'bottom-right':
      return { x: 0.68, y: 0.95, width: 0.28, height: 0.04 }
    case 'bottom-center':
      return { x: 0.34, y: 0.95, width: 0.32, height: 0.04 }
  }
}
