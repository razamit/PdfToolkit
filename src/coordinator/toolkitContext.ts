import { createContext, useContext } from 'react'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  EditorTool,
  ExportDecorations,
  FormFieldDescriptor,
  FormValuesBySource,
  TextAnnotationPatch,
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
  /** Append a synthetic blank page matching the document's prevailing paper size. */
  addBlankPage: () => void
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

  /**
   * The page whose editing session is open, or null when none is. The session
   * spans many actions: it is opened once from the page's Edit button and
   * closed only by the user, never by completing an action.
   */
  editingPage: PageDescriptor | null
  /** Tool armed inside the session; null is the idle state (move & resize). */
  editorTool: EditorTool | null
  openEditor: (pageId: string) => void
  closeEditor: () => void
  setEditorTool: (tool: EditorTool | null) => void

  /** Session library of drawn signatures, newest first. */
  signatureLibrary: StoredSignature[]
  /**
   * Add a signature to a page. The page updates immediately and the editing
   * session stays open. `newSignature` is stored in the session library; pass
   * null when an unmodified library signature was reused, so no duplicate
   * entry is created.
   */
  addSignature: (
    pageId: string,
    placement: SignaturePlacement,
    newSignature: RememberedSignature | null,
  ) => void
  removeSignature: (pageId: string, signatureId: string) => void
  /** Move/resize a placed signature; the rect stays in its sign-time frame. */
  updateSignatureRect: (pageId: string, signatureId: string, rect: NormalizedRect) => void

  /** Add an annotation. Applies to the page at once; the session stays open. */
  addAnnotation: (pageId: string, placement: AnnotationPlacement) => void
  removeAnnotation: (pageId: string, annotationId: string) => void
  /** Move/resize a text or image annotation; the patch stays in its creation frame. */
  updateAnnotationPlacement: (
    pageId: string,
    annotationId: string,
    patch: AnnotationPlacementPatch,
  ) => void
  /** Rewrite a placed text annotation's content and style (the in-place edit). */
  updateTextAnnotation: (
    pageId: string,
    annotationId: string,
    patch: TextAnnotationPatch,
  ) => void

  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  /** Export arbitrary page groups as one PDF or as separate PDFs in a ZIP. */
  exportPageGroups: (pageIdGroups: string[][], mode: 'combined' | 'zip') => Promise<void>

  exportDecorations: ExportDecorations
  setExportDecorations: (options: ExportDecorations) => void

  cropPages: (pageIds: string[], rect: NormalizedRect | null) => void
  ocrPages: (pageIds: string[]) => Promise<void>

  formValues: FormValuesBySource
  getFormFields: () => FormFieldDescriptor[]
  setFormValues: (values: FormValuesBySource) => void
}

export const ToolkitContext = createContext<ToolkitContextValue | null>(null)

export function usePdfToolkit(): ToolkitContextValue {
  const value = useContext(ToolkitContext)
  if (!value) throw new Error('usePdfToolkit must be used within <PdfToolkitProvider>')
  return value
}
