import { createContext, useContext } from 'react'
import type { GridColumns, PageDescriptor } from '@/domain/types'
import type { Selection } from '@/hooks/useSelection'
import type { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import type { ImageImportManager } from '@/managers/ImageImportManager'

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
  getSourceName: (sourceId: string) => string | undefined

  addFiles: (files: FileList | File[]) => Promise<void>
  removePages: (ids: string[]) => void
  rotatePages: (ids: string[], delta: number) => void
  reorder: (activeId: string, overId: string) => void
  exportPdf: (scope: ExportScope) => Promise<void>
  resetAll: () => void
  setGridColumns: (columns: GridColumns) => void
  dismissError: () => void
}

export const ToolkitContext = createContext<ToolkitContextValue | null>(null)

export function usePdfToolkit(): ToolkitContextValue {
  const value = useContext(ToolkitContext)
  if (!value) throw new Error('usePdfToolkit must be used within <PdfToolkitProvider>')
  return value
}
