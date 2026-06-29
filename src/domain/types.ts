/**
 * Core domain model. Everything in the app orchestrates an ordered list of
 * `PageDescriptor`s, decoupled from rendering (pdf.js) and export (pdf-lib).
 *
 * Heavy runtime handles (the pdf.js document, the pdf-lib document) live inside
 * the managers, keyed by `sourceId`. These domain types stay lightweight.
 */

export type Rotation = 0 | 90 | 180 | 270

export type SourceKind = 'pdf' | 'image'

export type ImageFormat = 'jpeg' | 'png'

/** Metadata for an uploaded file. Original bytes are retained for lossless export. */
export interface SourceMeta {
  id: string
  kind: SourceKind
  name: string
  /** Pristine source bytes — never mutated, used to rebuild the export losslessly. */
  originalBytes: Uint8Array
  /** Number of pages this source contributes (PDFs: page count; images: 1). */
  pageCount: number
  /** Image encoding; only present for image sources. */
  imageFormat?: ImageFormat
}

/** A single page in the working document, referencing its source. */
export interface PageDescriptor {
  /** Stable unique id for this page instance (also the dnd-kit sortable id). */
  id: string
  sourceId: string
  kind: SourceKind
  /** Page index within the source PDF; always 0 for images. */
  sourcePageIndex: number
  /** User-applied rotation, composed with any rotation already in the source. */
  rotation: Rotation
  /** Intrinsic page width (PDF points, or image pixels) before rotation. */
  width: number
  /** Intrinsic page height (PDF points, or image pixels) before rotation. */
  height: number
}

/** Grid sizing: bucketed column counts (more columns = smaller thumbnails). */
export type GridColumns = 2 | 3 | 4 | 6

export interface GridSizeOption {
  columns: GridColumns
  label: string
}
