import { createContext, useContext } from 'react'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  AnnotationTool,
  GridColumns,
  NormalizedRect,
  PageDescriptor,
  PageSizeMode,
  RememberedSignature,
  SignaturePlacement,
  StoredSignature,
} from '@/domain/types'
import type { Selection } from '@/hooks/useSelection'
import type { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import type { ImageImportManager } from '@/managers/ImageImportManager'
import type { TextContentManager } from '@/managers/TextContentManager'

export type ExportScope = 'all' | 'selected'

export interface ToolkitContextValue {
  /** Ordered working pages (the single source of truth for the grid). */
  pages: PageDescriptor[]
  gridColumns: GridColumns
  selection: Selection
  isBusy: boolean
  busyLabel: string | null
  error: string | null

  /** Managers needed by presentation components for rendering/lookup. */
  thumbnailRenderer: ThumbnailRenderManager
  imageManager: ImageImportManager
  textContent: TextContentManager
  getSourceName: (sourceId: string) => string | undefined
  /** Categorical color identifying a source (undefined if never assigned). */
  getSourceColor: (sourceId: string) => string | undefined

  /** Page size applied to the whole document at export ('original' = keep sizes). */
  pageSizeMode: PageSizeMode
  setPageSizeMode: (mode: PageSizeMode) => void

  addFiles: (files: FileList | File[]) => Promise<void>
  removePages: (ids: string[]) => void
  /** Remove every page belonging to one source (the whole uploaded file). */
  removeSource: (sourceId: string) => void
  rotatePages: (ids: string[], delta: number) => void
  /** Set the export size of the given pages to a preset ('original' restores full size). */
  resizePages: (ids: string[], preset: PageSizeMode) => void
  reorder: (activeId: string, overId: string) => void
  exportPdf: (scope: ExportScope) => Promise<void>
  resetAll: () => void
  setGridColumns: (columns: GridColumns) => void
  dismissError: () => void

  /** Page currently being signed (null while the signature modal is closed). */
  signingPage: PageDescriptor | null
  /** Session library of drawn signatures, newest first. */
  signatureLibrary: StoredSignature[]
  beginSign: (pageId: string) => void
  cancelSign: () => void
  /**
   * Add a signature to a page and close the modal. `newSignature` is stored in
   * the session library; pass null when an unmodified library signature was
   * reused, so no duplicate entry is created.
   */
  addSignature: (
    pageId: string,
    placement: SignaturePlacement,
    newSignature: RememberedSignature | null,
  ) => void
  removeSignature: (pageId: string, signatureId: string) => void
  /** Move/resize a placed signature; the rect stays in its sign-time frame. */
  updateSignatureRect: (pageId: string, signatureId: string, rect: NormalizedRect) => void

  /** Page currently being annotated (null while no annotation modal is open). */
  annotatingPage: PageDescriptor | null
  /** Which annotation tool the open modal belongs to (null when closed). */
  annotatingTool: AnnotationTool | null
  beginAnnotate: (pageId: string, tool: AnnotationTool) => void
  cancelAnnotate: () => void
  /** Add an annotation. The modal stays open — each modal closes itself via `cancelAnnotate`. */
  addAnnotation: (pageId: string, placement: AnnotationPlacement) => void
  removeAnnotation: (pageId: string, annotationId: string) => void
  /** Move/resize a text or image annotation; the patch stays in its creation frame. */
  updateAnnotationPlacement: (
    pageId: string,
    annotationId: string,
    patch: AnnotationPlacementPatch,
  ) => void
}

export const ToolkitContext = createContext<ToolkitContextValue | null>(null)

export function usePdfToolkit(): ToolkitContextValue {
  const value = useContext(ToolkitContext)
  if (!value) throw new Error('usePdfToolkit must be used within <PdfToolkitProvider>')
  return value
}
