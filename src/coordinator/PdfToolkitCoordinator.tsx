import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { PdfSourceManager } from '@/managers/PdfSourceManager'
import { ImageImportManager } from '@/managers/ImageImportManager'
import { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import { TextContentManager } from '@/managers/TextContentManager'
import { PdfExportManager } from '@/managers/PdfExportManager'
import { PageListManager } from '@/managers/PageListManager'
import { SourceColorRegistry } from '@/managers/SourceColorRegistry'
import { createAnalyticsTracker } from '@/analytics/createAnalyticsTracker'
import { SourceLoadError } from '@/domain/errors'
import { downloadPdf } from '@/lib/download'
import { createId } from '@/lib/id'
import { useSelection } from '@/hooks/useSelection'
import { resizePagesToPreset } from '@/lib/pageSizing'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  EditorTool,
  GridColumns,
  NormalizedRect,
  PageDescriptor,
  PageSizeMode,
  RememberedSignature,
  SignaturePlacement,
  SourceMeta,
  StoredSignature,
} from '@/domain/types'
import {
  ToolkitContext,
  type ExportScope,
  type ToolkitContextValue,
} from './toolkitContext'

function createManagers() {
  const pdfSources = new PdfSourceManager()
  const imageManager = new ImageImportManager()
  const thumbnailRenderer = new ThumbnailRenderManager(pdfSources)
  const textContent = new TextContentManager(pdfSources)
  const exporter = new PdfExportManager(pdfSources, imageManager)
  const colorRegistry = new SourceColorRegistry()
  const analytics = createAnalyticsTracker()
  return {
    pdfSources,
    imageManager,
    thumbnailRenderer,
    textContent,
    exporter,
    colorRegistry,
    analytics,
  }
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Oldest library entries are dropped beyond this (each holds a PNG data URL). */
const SIGNATURE_LIBRARY_LIMIT = 12

function toErrorMessage(file: File, error: unknown): string {
  if (error instanceof SourceLoadError) return error.message
  return `"${file.name}" could not be loaded.`
}

/**
 * Owns all working state (pages, grid size, selection, status) and wires the
 * managers together. Components read everything through `usePdfToolkit`.
 *
 * Pages are the single source of truth; source metadata lives in a ref-backed
 * map and orphaned sources are released (pdf.js docs destroyed, object URLs
 * revoked) whenever they stop being referenced by any page.
 */
export function PdfToolkitProvider({ children }: { children: ReactNode }) {
  const managersRef = useRef<ReturnType<typeof createManagers> | null>(null)
  if (!managersRef.current) managersRef.current = createManagers()
  const {
    pdfSources,
    imageManager,
    thumbnailRenderer,
    textContent,
    exporter,
    colorRegistry,
    analytics,
  } = managersRef.current

  const [pages, setPages] = useState<PageDescriptor[]>([])
  const [gridColumns, setGridColumns] = useState<GridColumns>(4)
  const [pageSizeMode, setPageSizeMode] = useState<PageSizeMode>('original')
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signatureLibrary, setSignatureLibrary] = useState<StoredSignature[]>([])
  // One page is edited at a time, in a session that stays open across actions.
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editorTool, setEditorTool] = useState<EditorTool | null>(null)

  const pagesRef = useRef<PageDescriptor[]>([])
  const sourcesRef = useRef<Map<string, SourceMeta>>(new Map())

  const orderedIds = useMemo(() => pages.map((page) => page.id), [pages])
  const selection = useSelection(orderedIds)
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const releaseSource = useCallback(
    (meta: SourceMeta) => {
      if (meta.kind === 'pdf') {
        thumbnailRenderer.invalidateSource(meta.id)
        textContent.invalidateSource(meta.id)
        pdfSources.remove(meta.id)
      } else {
        imageManager.remove(meta.id)
      }
    },
    [thumbnailRenderer, textContent, pdfSources, imageManager],
  )

  const applyPages = useCallback(
    (next: PageDescriptor[]) => {
      const usedSourceIds = new Set(next.map((page) => page.sourceId))
      for (const [sourceId, meta] of sourcesRef.current) {
        if (!usedSourceIds.has(sourceId)) {
          releaseSource(meta)
          sourcesRef.current.delete(sourceId)
          colorRegistry.release(sourceId)
        }
      }
      pagesRef.current = next
      setPages(next)
    },
    [releaseSource, colorRegistry],
  )

  const loadFile = useCallback(
    async (file: File): Promise<{ meta: SourceMeta; pages: PageDescriptor[] }> => {
      if (isPdf(file)) {
        const result = await pdfSources.load(file)
        return { meta: result.meta, pages: result.pages }
      }
      if (file.type.startsWith('image/')) {
        const result = await imageManager.load(file)
        return { meta: result.meta, pages: [result.page] }
      }
      throw new SourceLoadError(`"${file.name}" isn't a PDF or supported image.`)
    },
    [pdfSources, imageManager],
  )

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (files.length === 0) return
      setBusyLabel('Loading files…')
      setError(null)

      const added: PageDescriptor[] = []
      const failures: string[] = []
      for (const file of files) {
        try {
          const result = await loadFile(file)
          sourcesRef.current.set(result.meta.id, result.meta)
          colorRegistry.assign(result.meta.id)
          added.push(...result.pages)
          analytics.track({
            name: 'file-added',
            kind: result.meta.kind,
            pageCount: result.pages.length,
          })
        } catch (loadError) {
          failures.push(toErrorMessage(file, loadError))
        }
      }
      if (added.length > 0) applyPages([...pagesRef.current, ...added])
      setBusyLabel(null)
      if (failures.length > 0) setError(failures.join('\n'))
    },
    [loadFile, applyPages, analytics, colorRegistry],
  )

  const removePages = useCallback(
    (ids: string[]) => {
      applyPages(PageListManager.remove(pagesRef.current, new Set(ids)))
      analytics.track({ name: 'pages-removed', count: ids.length })
    },
    [applyPages, analytics],
  )

  const removeSource = useCallback(
    (sourceId: string) => {
      const count = pagesRef.current.filter((page) => page.sourceId === sourceId).length
      if (count === 0) return
      applyPages(PageListManager.removeBySource(pagesRef.current, sourceId))
      analytics.track({ name: 'pages-removed', count })
    },
    [applyPages, analytics],
  )

  const rotatePages = useCallback(
    (ids: string[], delta: number) => {
      applyPages(PageListManager.rotate(pagesRef.current, new Set(ids), delta))
      analytics.track({ name: 'pages-rotated', count: ids.length })
    },
    [applyPages, analytics],
  )

  const resizePages = useCallback(
    (ids: string[], preset: PageSizeMode) => {
      applyPages(resizePagesToPreset(pagesRef.current, new Set(ids), preset))
      analytics.track({ name: 'pages-resized', preset })
    },
    [applyPages, analytics],
  )

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      applyPages(PageListManager.moveById(pagesRef.current, activeId, overId))
      analytics.track({ name: 'pages-reordered' })
    },
    [applyPages, analytics],
  )

  const editingPage = useMemo(
    () => pages.find((page) => page.id === editingPageId) ?? null,
    [pages, editingPageId],
  )

  /** Open the editing session on a page, idle — no tool armed. */
  const openEditor = useCallback((pageId: string) => {
    setEditingPageId(pageId)
    setEditorTool(null)
  }, [])

  const closeEditor = useCallback(() => {
    setEditingPageId(null)
    setEditorTool(null)
  }, [])

  const addSignature = useCallback(
    (pageId: string, placement: SignaturePlacement, newSignature: RememberedSignature | null) => {
      if (newSignature) {
        setSignatureLibrary((previous) =>
          [{ ...newSignature, id: createId('sig') }, ...previous].slice(0, SIGNATURE_LIBRARY_LIMIT),
        )
      }
      // The page updates immediately and the session stays open; the panel
      // disarms its own tool so the user lands back on the idle page.
      applyPages(PageListManager.addSignature(pagesRef.current, pageId, placement))
      analytics.track({ name: 'signature-added', reused: newSignature === null })
    },
    [applyPages, analytics],
  )

  const removeSignature = useCallback(
    (pageId: string, signatureId: string) =>
      applyPages(PageListManager.removeSignature(pagesRef.current, pageId, signatureId)),
    [applyPages],
  )

  const updateSignatureRect = useCallback(
    (pageId: string, signatureId: string, rect: NormalizedRect) =>
      applyPages(PageListManager.updateSignatureRect(pagesRef.current, pageId, signatureId, rect)),
    [applyPages],
  )

  const addAnnotation = useCallback(
    (pageId: string, placement: AnnotationPlacement) => {
      applyPages(PageListManager.addAnnotation(pagesRef.current, pageId, placement))
      analytics.track({ name: 'annotation-added', kind: placement.kind })
    },
    [applyPages, analytics],
  )

  const removeAnnotation = useCallback(
    (pageId: string, annotationId: string) =>
      applyPages(PageListManager.removeAnnotation(pagesRef.current, pageId, annotationId)),
    [applyPages],
  )

  const updateAnnotationPlacement = useCallback(
    (pageId: string, annotationId: string, patch: AnnotationPlacementPatch) =>
      applyPages(
        PageListManager.updateAnnotationPlacement(pagesRef.current, pageId, annotationId, patch),
      ),
    [applyPages],
  )

  const exportPdf = useCallback(
    async (scope: ExportScope) => {
      const selectedIds = selectionRef.current.selectedIds
      const target =
        scope === 'selected'
          ? pagesRef.current.filter((page) => selectedIds.has(page.id))
          : pagesRef.current
      if (target.length === 0) {
        setError(
          scope === 'selected' ? 'Select at least one page to export.' : 'Add some pages first.',
        )
        return
      }
      setBusyLabel('Building your PDF…')
      setError(null)
      try {
        const bytes = await exporter.export(target, pageSizeMode)
        downloadPdf(bytes, 'freepdfmachine-export.pdf')
        // Tracked only after the bytes exist, so the count means "PDFs produced",
        // not "export attempted".
        analytics.track({ name: 'pdf-exported', scope, pageCount: target.length })
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : 'Export failed.')
      } finally {
        setBusyLabel(null)
      }
    },
    [exporter, pageSizeMode, analytics],
  )

  const resetAll = useCallback(() => {
    thumbnailRenderer.clear()
    textContent.clear()
    pdfSources.destroyAll()
    imageManager.destroyAll()
    sourcesRef.current.clear()
    colorRegistry.clear()
    pagesRef.current = []
    setPages([])
    selectionRef.current.clear()
    setEditingPageId(null)
    setEditorTool(null)
    setError(null)
  }, [thumbnailRenderer, textContent, pdfSources, imageManager, colorRegistry])

  const getSourceName = useCallback((sourceId: string) => sourcesRef.current.get(sourceId)?.name, [])
  const getSourceColor = useCallback(
    (sourceId: string) => colorRegistry.colorFor(sourceId),
    [colorRegistry],
  )
  const dismissError = useCallback(() => setError(null), [])

  const value = useMemo<ToolkitContextValue>(
    () => ({
      pages,
      gridColumns,
      selection,
      isBusy: busyLabel !== null,
      busyLabel,
      error,
      thumbnailRenderer,
      imageManager,
      textContent,
      getSourceName,
      getSourceColor,
      pageSizeMode,
      setPageSizeMode,
      addFiles,
      removePages,
      removeSource,
      rotatePages,
      resizePages,
      reorder,
      exportPdf,
      resetAll,
      setGridColumns,
      dismissError,
      editingPage,
      editorTool,
      openEditor,
      closeEditor,
      setEditorTool,
      signatureLibrary,
      addSignature,
      removeSignature,
      updateSignatureRect,
      addAnnotation,
      removeAnnotation,
      updateAnnotationPlacement,
    }),
    [
      pages,
      gridColumns,
      selection,
      busyLabel,
      error,
      thumbnailRenderer,
      imageManager,
      textContent,
      getSourceName,
      getSourceColor,
      pageSizeMode,
      addFiles,
      removePages,
      removeSource,
      rotatePages,
      resizePages,
      reorder,
      exportPdf,
      resetAll,
      dismissError,
      editingPage,
      editorTool,
      openEditor,
      closeEditor,
      signatureLibrary,
      addSignature,
      removeSignature,
      updateSignatureRect,
      addAnnotation,
      removeAnnotation,
      updateAnnotationPlacement,
    ],
  )

  return <ToolkitContext.Provider value={value}>{children}</ToolkitContext.Provider>
}
