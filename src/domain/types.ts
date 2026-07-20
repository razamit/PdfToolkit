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

/** Axis-aligned rect in [0,1] fractions of a displayed page box; origin top-left, y down. */
export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

/** One point of a signature stroke, in [0,1] fractions of its drawing surface. */
export interface StrokePoint {
  x: number
  y: number
}

export type SignatureStroke = StrokePoint[]

/** A hand-drawn signature stamped onto one page. */
export interface SignaturePlacement {
  id: string
  /** Transparent PNG data URL of the ink, cropped to its bounding box. */
  pngDataUrl: string
  /** Placement in the page box as it was displayed when the user signed. */
  rect: NormalizedRect
  /** The page's user rotation at the moment of signing — frozen, never rewritten on later rotates. */
  rotationAtSign: Rotation
}

/** Session-remembered last drawn signature, kept as vectors for crisp re-rendering. */
export interface RememberedSignature {
  /** Strokes normalized to the ink bounding box. */
  strokes: SignatureStroke[]
  /** Width / height of the ink bounding box in absolute display units. */
  aspectRatio: number
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
  /** Hand-drawn signatures stamped onto this page (absent when none). */
  signatures?: SignaturePlacement[]
}

/** Grid sizing: bucketed column counts (more columns = smaller thumbnails). */
export type GridColumns = 2 | 3 | 4 | 6

export interface GridSizeOption {
  columns: GridColumns
  label: string
}
