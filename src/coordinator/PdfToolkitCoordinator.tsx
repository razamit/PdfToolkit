import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PdfSourceManager } from '@/managers/PdfSourceManager'
import { ImageImportManager } from '@/managers/ImageImportManager'
import {
  SheetImportManager,
  spreadsheetFormatOf,
  unsupportedSpreadsheetReason,
} from '@/managers/SheetImportManager'
import { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import { TextContentManager } from '@/managers/TextContentManager'
import { PdfExportManager } from '@/managers/PdfExportManager'
import { OcrManager } from '@/managers/OcrManager'
import { PageListManager } from '@/managers/PageListManager'
import { SourceColorRegistry } from '@/managers/SourceColorRegistry'
import { createAnalyticsTracker } from '@/analytics/createAnalyticsTracker'
import { SourceLoadError } from '@/domain/errors'
import { downloadBlob, downloadPdf } from '@/lib/download'
import { createId } from '@/lib/id'
import { useSelection } from '@/hooks/useSelection'
import { preferredBlankPageSize, resizePagesToPreset } from '@/lib/pageSizing'
import { DEFAULT_EXPORT_DECORATIONS } from '@/lib/exportDecorationDefaults'
import type {
  AnnotationPlacement,
  AnnotationPlacementPatch,
  EditorTool,
  ExportDecorations,
  FormFieldDescriptor,
  FormValuesBySource,
  GridColumns,
  NormalizedRect,
  PageDescriptor,
  PageSizeMode,
  RememberedSignature,
  SignaturePlacement,
  SourceMeta,
  StoredSignature,
  TextAnnotationPatch,
} from '@/domain/types'
import {
  ToolkitContext,
  type ExportScope,
  type ToolkitContextValue,
} from './toolkitContext'

function createManagers() {
  const pdfSources = new PdfSourceManager()
  const imageManager = new ImageImportManager()
  const sheetImporter = new SheetImportManager()
  const thumbnailRenderer = new ThumbnailRenderManager(pdfSources)
  const textContent = new TextContentManager(pdfSources)
  const exporter = new PdfExportManager(pdfSources, imageManager)
  const ocr = new OcrManager(thumbnailRenderer, imageManager)
  const colorRegistry = new SourceColorRegistry()
  const analytics = createAnalyticsTracker()
  return {
    pdfSources,
    imageManager,
    sheetImporter,
    thumbnailRenderer,
    textContent,
    exporter,
    ocr,
    colorRegistry,
    analytics,
  }
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Oldest library entries are dropped beyond this (each holds a PNG data URL). */
const SIGNATURE_LIBRARY_LIMIT = 12
const HISTORY_LIMIT = 100

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
    sheetImporter,
    thumbnailRenderer,
    textContent,
    exporter,
    ocr,
    colorRegistry,
    analytics,
  } = managersRef.current

  const [pages, setPages] = useState<PageDescriptor[]>([])
  const [gridColumns, setGridColumns] = useState<GridColumns>(4)
  const [pageSizeMode, setPageSizeMode] = useState<PageSizeMode>('original')
  const [exportDecorations, setExportDecorationsState] = useState<ExportDecorations>(
    DEFAULT_EXPORT_DECORATIONS,
  )
  const [formValues, setFormValuesState] = useState<FormValuesBySource>({})
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signatureLibrary, setSignatureLibrary] = useState<StoredSignature[]>([])
  // One page is edited at a time, in a session that stays open across actions.
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editorTool, setEditorTool] = useState<EditorTool | null>(null)

  const pagesRef = useRef<PageDescriptor[]>([])
  const sourcesRef = useRef<Map<string, SourceMeta>>(new Map())
  const blankSourceIdRef = useRef<string | null>(null)
  const pastPagesRef = useRef<PageDescriptor[][]>([])
  const futurePagesRef = useRef<PageDescriptor[][]>([])
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const orderedIds = useMemo(() => pages.map((page) => page.id), [pages])
  const selection = useSelection(orderedIds)
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const applyPages = useCallback(
    (next: PageDescriptor[]) => {
      if (next === pagesRef.current) return
      pastPagesRef.current = [...pastPagesRef.current.slice(-(HISTORY_LIMIT - 1)), pagesRef.current]
      futurePagesRef.current = []
      pagesRef.current = next
      setPages(next)
      setHistoryState({ canUndo: true, canRedo: false })
    },
    [],
  )

  const undo = useCallback(() => {
    const previous = pastPagesRef.current.at(-1)
    if (!previous) return
    pastPagesRef.current = pastPagesRef.current.slice(0, -1)
    futurePagesRef.current = [pagesRef.current, ...futurePagesRef.current].slice(0, HISTORY_LIMIT)
    pagesRef.current = previous
    setPages(previous)
    setHistoryState({
      canUndo: pastPagesRef.current.length > 0,
      canRedo: futurePagesRef.current.length > 0,
    })
  }, [])

  const redo = useCallback(() => {
    const next = futurePagesRef.current[0]
    if (!next) return
    futurePagesRef.current = futurePagesRef.current.slice(1)
    pastPagesRef.current = [...pastPagesRef.current, pagesRef.current].slice(-HISTORY_LIMIT)
    pagesRef.current = next
    setPages(next)
    setHistoryState({ canUndo: true, canRedo: futurePagesRef.current.length > 0 })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return
      }
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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
      const spreadsheet = spreadsheetFormatOf(file)
      if (spreadsheet) {
        // Converted on-device to PDF bytes, then loaded through the ordinary PDF
        // path — so its pages annotate, crop, split and export like any other.
        const bytes = await sheetImporter.convertToPdfBytes(file, spreadsheet)
        const converted = new File([bytes as BlobPart], file.name, { type: 'application/pdf' })
        const result = await pdfSources.load(converted)
        return { meta: result.meta, pages: result.pages }
      }
      const unsupported = unsupportedSpreadsheetReason(file)
      throw new SourceLoadError(
        unsupported ?? `"${file.name}" isn't a PDF, image, or spreadsheet we can read.`,
      )
    },
    [pdfSources, imageManager, sheetImporter],
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

  const addBlankPage = useCallback(() => {
    let sourceId = blankSourceIdRef.current
    if (!sourceId) {
      sourceId = createId('blank')
      blankSourceIdRef.current = sourceId
      colorRegistry.assign(sourceId)
    }
    const { width, height } = preferredBlankPageSize(pagesRef.current)
    const page: PageDescriptor = {
      id: createId('page'),
      sourceId,
      kind: 'blank',
      sourcePageIndex: 0,
      rotation: 0,
      width,
      height,
    }
    applyPages([...pagesRef.current, page])
  }, [applyPages, colorRegistry])

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

  const updateTextAnnotation = useCallback(
    (pageId: string, annotationId: string, patch: TextAnnotationPatch) =>
      applyPages(
        PageListManager.updateTextAnnotation(pagesRef.current, pageId, annotationId, patch),
      ),
    [applyPages],
  )

  const cropPages = useCallback(
    (pageIds: string[], rect: NormalizedRect | null) =>
      applyPages(PageListManager.crop(pagesRef.current, new Set(pageIds), rect)),
    [applyPages],
  )

  const ocrPages = useCallback(
    async (pageIds: string[]) => {
      const requested = new Set(pageIds)
      const targets = pagesRef.current.filter((page) => requested.has(page.id))
      if (targets.length === 0) return
      setError(null)
      let next = pagesRef.current
      try {
        for (const [index, page] of targets.entries()) {
          setBusyLabel(`Reading page ${index + 1} of ${targets.length}…`)
          const words = await ocr.recognizePage(page, (progress, status) => {
            const percent = Math.round(progress * 100)
            setBusyLabel(`OCR page ${index + 1} of ${targets.length} · ${status} ${percent}%`)
          })
          next = PageListManager.setOcrWords(next, page.id, words)
        }
        applyPages(next)
      } catch (ocrError) {
        setError(ocrError instanceof Error ? ocrError.message : 'OCR failed.')
      } finally {
        setBusyLabel(null)
      }
    },
    [ocr, applyPages],
  )

  const getFormFields = useCallback((): FormFieldDescriptor[] => {
    const fields: FormFieldDescriptor[] = []
    for (const [sourceId, meta] of sourcesRef.current) {
      if (meta.kind === 'pdf') fields.push(...pdfSources.listFormFields(sourceId))
    }
    return fields
  }, [pdfSources])

  const setFormValues = useCallback((values: FormValuesBySource) => {
    setFormValuesState(values)
  }, [])

  const setExportDecorations = useCallback((options: ExportDecorations) => {
    setExportDecorationsState(options)
  }, [])

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
        const bytes = await exporter.export(target, pageSizeMode, {
          decorations: exportDecorations,
          formValues,
        })
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
    [exporter, pageSizeMode, exportDecorations, formValues, analytics],
  )

  const exportPageGroups = useCallback(
    async (pageIdGroups: string[][], mode: 'combined' | 'zip') => {
      const byId = new Map(pagesRef.current.map((page) => [page.id, page]))
      const groups = pageIdGroups
        .map((ids) => ids.map((id) => byId.get(id)).filter((page): page is PageDescriptor => !!page))
        .filter((group) => group.length > 0)
      if (groups.length === 0) {
        setError('Choose at least one valid page to export.')
        return
      }
      setBusyLabel(mode === 'zip' ? 'Building split PDFs…' : 'Building extracted PDF…')
      setError(null)
      try {
        if (mode === 'combined') {
          const bytes = await exporter.export(groups.flat(), pageSizeMode, {
            decorations: exportDecorations,
            formValues,
          })
          downloadPdf(bytes, 'freepdfmachine-extract.pdf')
        } else {
          const files: Record<string, Uint8Array> = {}
          for (const [index, group] of groups.entries()) {
            files[`freepdfmachine-part-${String(index + 1).padStart(2, '0')}.pdf`] =
              await exporter.export(group, pageSizeMode, {
                decorations: exportDecorations,
                formValues,
              })
          }
          const { zipSync } = await import('fflate')
          const archive = zipSync(files, { level: 0 })
          downloadBlob(new Blob([archive as BlobPart], { type: 'application/zip' }), 'freepdfmachine-split.zip')
        }
        analytics.track({
          name: 'pdf-exported',
          scope: 'selected',
          pageCount: groups.reduce((sum, group) => sum + group.length, 0),
        })
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : 'Export failed.')
      } finally {
        setBusyLabel(null)
      }
    },
    [exporter, pageSizeMode, exportDecorations, formValues, analytics],
  )

  const resetAll = useCallback(() => {
    thumbnailRenderer.clear()
    textContent.clear()
    pdfSources.destroyAll()
    imageManager.destroyAll()
    void ocr.destroy()
    sourcesRef.current.clear()
    blankSourceIdRef.current = null
    colorRegistry.clear()
    pagesRef.current = []
    setPages([])
    pastPagesRef.current = []
    futurePagesRef.current = []
    setHistoryState({ canUndo: false, canRedo: false })
    setPageSizeMode('original')
    setExportDecorationsState(DEFAULT_EXPORT_DECORATIONS)
    setFormValuesState({})
    selectionRef.current.clear()
    setEditingPageId(null)
    setEditorTool(null)
    setError(null)
  }, [thumbnailRenderer, textContent, pdfSources, imageManager, ocr, colorRegistry])

  const getSourceName = useCallback(
    (sourceId: string) =>
      sourceId === blankSourceIdRef.current
        ? 'Blank pages'
        : sourcesRef.current.get(sourceId)?.name,
    [],
  )
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
      exportDecorations,
      setExportDecorations,
      formValues,
      getFormFields,
      setFormValues,
      addFiles,
      addBlankPage,
      removePages,
      removeSource,
      rotatePages,
      resizePages,
      reorder,
      exportPdf,
      exportPageGroups,
      cropPages,
      ocrPages,
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
      updateTextAnnotation,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      undo,
      redo,
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
      exportDecorations,
      setExportDecorations,
      formValues,
      getFormFields,
      setFormValues,
      addFiles,
      addBlankPage,
      removePages,
      removeSource,
      rotatePages,
      resizePages,
      reorder,
      exportPdf,
      exportPageGroups,
      cropPages,
      ocrPages,
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
      updateTextAnnotation,
      historyState,
      undo,
      redo,
    ],
  )

  return <ToolkitContext.Provider value={value}>{children}</ToolkitContext.Provider>
}
