import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { PdfSourceManager } from '@/managers/PdfSourceManager'
import { ImageImportManager } from '@/managers/ImageImportManager'
import { ThumbnailRenderManager } from '@/managers/ThumbnailRenderManager'
import { PdfExportManager } from '@/managers/PdfExportManager'
import { PageListManager } from '@/managers/PageListManager'
import { SourceLoadError } from '@/domain/errors'
import { downloadPdf } from '@/lib/download'
import { createId } from '@/lib/id'
import { useSelection } from '@/hooks/useSelection'
import type {
  GridColumns,
  PageDescriptor,
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
  const exporter = new PdfExportManager(pdfSources, imageManager)
  return { pdfSources, imageManager, thumbnailRenderer, exporter }
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
  const { pdfSources, imageManager, thumbnailRenderer, exporter } = managersRef.current

  const [pages, setPages] = useState<PageDescriptor[]>([])
  const [gridColumns, setGridColumns] = useState<GridColumns>(4)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingPageId, setSigningPageId] = useState<string | null>(null)
  const [signatureLibrary, setSignatureLibrary] = useState<StoredSignature[]>([])

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
        pdfSources.remove(meta.id)
      } else {
        imageManager.remove(meta.id)
      }
    },
    [thumbnailRenderer, pdfSources, imageManager],
  )

  const applyPages = useCallback(
    (next: PageDescriptor[]) => {
      const usedSourceIds = new Set(next.map((page) => page.sourceId))
      for (const [sourceId, meta] of sourcesRef.current) {
        if (!usedSourceIds.has(sourceId)) {
          releaseSource(meta)
          sourcesRef.current.delete(sourceId)
        }
      }
      pagesRef.current = next
      setPages(next)
    },
    [releaseSource],
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
          added.push(...result.pages)
        } catch (loadError) {
          failures.push(toErrorMessage(file, loadError))
        }
      }
      if (added.length > 0) applyPages([...pagesRef.current, ...added])
      setBusyLabel(null)
      if (failures.length > 0) setError(failures.join('\n'))
    },
    [loadFile, applyPages],
  )

  const removePages = useCallback(
    (ids: string[]) => applyPages(PageListManager.remove(pagesRef.current, new Set(ids))),
    [applyPages],
  )

  const rotatePages = useCallback(
    (ids: string[], delta: number) =>
      applyPages(PageListManager.rotate(pagesRef.current, new Set(ids), delta)),
    [applyPages],
  )

  const reorder = useCallback(
    (activeId: string, overId: string) =>
      applyPages(PageListManager.moveById(pagesRef.current, activeId, overId)),
    [applyPages],
  )

  const signingPage = useMemo(
    () => pages.find((page) => page.id === signingPageId) ?? null,
    [pages, signingPageId],
  )

  const beginSign = useCallback((pageId: string) => setSigningPageId(pageId), [])
  const cancelSign = useCallback(() => setSigningPageId(null), [])

  const addSignature = useCallback(
    (pageId: string, placement: SignaturePlacement, newSignature: RememberedSignature | null) => {
      if (newSignature) {
        setSignatureLibrary((previous) =>
          [{ ...newSignature, id: createId('sig') }, ...previous].slice(0, SIGNATURE_LIBRARY_LIMIT),
        )
      }
      applyPages(PageListManager.addSignature(pagesRef.current, pageId, placement))
      setSigningPageId(null)
    },
    [applyPages],
  )

  const removeSignature = useCallback(
    (pageId: string, signatureId: string) =>
      applyPages(PageListManager.removeSignature(pagesRef.current, pageId, signatureId)),
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
        const bytes = await exporter.export(target)
        downloadPdf(bytes, 'pdf-toolkit-export.pdf')
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : 'Export failed.')
      } finally {
        setBusyLabel(null)
      }
    },
    [exporter],
  )

  const resetAll = useCallback(() => {
    thumbnailRenderer.clear()
    pdfSources.destroyAll()
    imageManager.destroyAll()
    sourcesRef.current.clear()
    pagesRef.current = []
    setPages([])
    selectionRef.current.clear()
    setSigningPageId(null)
    setError(null)
  }, [thumbnailRenderer, pdfSources, imageManager])

  const getSourceName = useCallback((sourceId: string) => sourcesRef.current.get(sourceId)?.name, [])
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
      getSourceName,
      addFiles,
      removePages,
      rotatePages,
      reorder,
      exportPdf,
      resetAll,
      setGridColumns,
      dismissError,
      signingPage,
      signatureLibrary,
      beginSign,
      cancelSign,
      addSignature,
      removeSignature,
    }),
    [
      pages,
      gridColumns,
      selection,
      busyLabel,
      error,
      thumbnailRenderer,
      imageManager,
      getSourceName,
      addFiles,
      removePages,
      rotatePages,
      reorder,
      exportPdf,
      resetAll,
      dismissError,
      signingPage,
      signatureLibrary,
      beginSign,
      cancelSign,
      addSignature,
      removeSignature,
    ],
  )

  return <ToolkitContext.Provider value={value}>{children}</ToolkitContext.Provider>
}
