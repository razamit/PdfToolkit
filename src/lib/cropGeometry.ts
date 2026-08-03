import type { PDFPage } from '@cantoo/pdf-lib'
import type { NormalizedRect, PageCrop, Rotation } from '@/domain/types'
import { normalizeRotation } from '@/managers/PageListManager'
import {
  displayedPointToUserSpace,
  rotateRect,
  type PageBox,
} from '@/lib/signatureGeometry'

/** Crop rect expressed in the page's current display frame. */
export function cropRectForFrame(crop: PageCrop | undefined, frameRotation: Rotation): NormalizedRect {
  if (!crop) return { x: 0, y: 0, width: 1, height: 1 }
  return rotateRect(crop.rect, normalizeRotation(frameRotation - crop.rotationAtCreate))
}

/** Convert a displayed normalized crop rectangle into an axis-aligned PDF user-space box. */
export function displayedCropToPageBox(
  rect: NormalizedRect,
  totalRotation: Rotation,
  pageBox: PageBox,
): PageBox {
  const sideways = totalRotation === 90 || totalRotation === 270
  const displayedWidth = sideways ? pageBox.height : pageBox.width
  const displayedHeight = sideways ? pageBox.width : pageBox.height
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ].map(([x, y]) =>
    displayedPointToUserSpace(x * displayedWidth, y * displayedHeight, totalRotation, pageBox),
  )
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: pageBox.x + minX,
    y: pageBox.y + minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/** Apply a descriptor crop after all page stamps have been drawn. */
export function applyPageCrop(
  page: PDFPage,
  crop: PageCrop | undefined,
  intrinsicRotation: number,
): void {
  if (!crop) return
  const current = page.getCropBox()
  const totalRotation = normalizeRotation(intrinsicRotation + crop.rotationAtCreate)
  const next = displayedCropToPageBox(crop.rect, totalRotation, current)
  page.setCropBox(next.x, next.y, next.width, next.height)
}
