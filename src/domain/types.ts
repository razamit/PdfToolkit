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

/** Fields shared by every annotation stamped onto a page. */
interface AnnotationBase {
  id: string
  /** The page's user rotation when the annotation was created — frozen, never rewritten on later rotates. */
  rotationAtCreate: Rotation
}

/** A Helvetica text box stamped onto one page. Lines break on explicit newlines only. */
export interface TextPlacement extends AnnotationBase {
  kind: 'text'
  text: string
  /** Placement in the page box as it was displayed when the text was added. */
  rect: NormalizedRect
  /** Font size in PDF points — exact in the exported document. */
  fontSizePt: number
  /** Text color as #rrggbb. */
  colorHex: string
}

/** An uploaded or pasted image stamped onto one page. */
export interface ImagePlacement extends AnnotationBase {
  kind: 'image'
  /** JPEG or PNG data URL, embedded as-is at export. */
  dataUrl: string
  format: ImageFormat
  /** Placement in the creation-time displayed page box, already aspect-fitted. */
  rect: NormalizedRect
}

/** A text highlight stamped onto one page as translucent line rectangles. */
export interface HighlightPlacement extends AnnotationBase {
  kind: 'highlight'
  /** One merged rect per highlighted text line, in the creation-time displayed frame. */
  lineRects: NormalizedRect[]
  /** Highlight color as #rrggbb, drawn with a Multiply blend. */
  colorHex: string
}

/** A free-hand / straight-line highlighter mark stamped onto one page. */
export interface FreehandHighlightPlacement extends AnnotationBase {
  kind: 'freehand-highlight'
  /** Ink strokes; each a path of normalized points in the creation-time
   *  displayed frame. A straight line is simply a 2-point stroke. */
  strokes: SignatureStroke[]
  /** Highlight color as #rrggbb, drawn with a Multiply blend. */
  colorHex: string
  /** Line thickness as a fraction of the smaller displayed page dimension
   *  (rotation-invariant), so it scales with page size. */
  thickness: number
}

export type AnnotationPlacement =
  | TextPlacement
  | ImagePlacement
  | HighlightPlacement
  | FreehandHighlightPlacement

export type AnnotationTool = 'text' | 'image' | 'highlight' | 'freehand-highlight' | 'arrange'

/** Geometry patch produced by moving or resizing a placed text/image annotation. */
export interface AnnotationPlacementPatch {
  /** New rect, still in the creation-time displayed frame. */
  rect: NormalizedRect
  /** New font size when a text annotation was scaled. */
  fontSizePt?: number
}

/** A drawn signature remembered for reuse, kept as vectors for crisp re-rendering. */
export interface RememberedSignature {
  /** Strokes normalized to the ink bounding box. */
  strokes: SignatureStroke[]
  /** Width / height of the ink bounding box in absolute display units. */
  aspectRatio: number
  /** Cropped transparent PNG of the ink — doubles as the library thumbnail. */
  pngDataUrl: string
}

/** A remembered signature stored in the session library. */
export interface StoredSignature extends RememberedSignature {
  id: string
}

/** Named page-size targets for resizing ('match' = the document's dominant page size). */
export type PageSizePreset = 'match' | 'a4' | 'letter'

/** Export page sizing: keep original sizes, or normalize every page to a preset. */
export type PageSizeMode = 'original' | PageSizePreset

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
  /** Uniform factor applied to the page box at export (absent = original size). */
  exportScale?: number
  /** Hand-drawn signatures stamped onto this page (absent when none). */
  signatures?: SignaturePlacement[]
  /** Text, image, and highlight annotations stamped onto this page (absent when none).
   *  Includes both text-anchored and free-hand highlights. */
  annotations?: AnnotationPlacement[]
}

/** Grid sizing: bucketed column counts (more columns = smaller thumbnails). */
export type GridColumns = 2 | 3 | 4 | 6

export interface GridSizeOption {
  columns: GridColumns
  label: string
}
