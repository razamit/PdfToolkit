import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { MarkSelectionContext } from '@/components/annotations/markSelectionContext'
import type { EditorTool, PageDescriptor } from '@/domain/types'
import { EditorToolbar } from './EditorToolbar'
import { MarksListPanel } from './MarksListPanel'
import { describePageMarks } from './pageMarks'
import { useEditorZoom } from './useEditorZoom'
import { IdleTool } from './tools/IdleTool'
import { TextTool } from './tools/TextTool'
import { SignTool } from './tools/SignTool'
import { ImageTool } from './tools/ImageTool'
import { HighlightTool } from './tools/HighlightTool'
import { FreehandTool } from './tools/FreehandTool'

/** Width below which the items list would leave no usable page area beside it. */
const SIDE_BY_SIDE_QUERY = '(min-width: 768px)'

/**
 * The page editing session — one dialog, opened from a page's Edit button and
 * closed only by the user.
 *
 * The design principle it exists to enforce: **finishing an action must not
 * end the session.** Every tool commits straight to the page (the coordinator
 * applies each add immediately, so nothing is staged and nothing is lost) and
 * then hands control back here, either staying armed for another mark or
 * dropping to the idle state. Previously each tool was its own modal that
 * closed on its single successful action, so placing three text boxes meant
 * opening and closing the dialog three times.
 *
 * Down the left is the items list: everything already on the page, so a mark
 * can be found, selected and removed without hunting for it on the page.
 *
 * Escape unwinds one step at a time — deselect, then disarm, then close — so a
 * stray press cannot discard a page you are part-way through editing.
 */
export function PageEditorModal() {
  const { editingPage, editorTool, setEditorTool, closeEditor } = usePdfToolkit()
  const zoom = useEditorZoom()
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia(SIDE_BY_SIDE_QUERY).matches,
  )

  const disarm = useCallback(() => setEditorTool(null), [setEditorTool])
  const markSelection = useMemo(
    () => ({ selectedMarkId, selectMark: setSelectedMarkId }),
    [selectedMarkId],
  )
  const marks = useMemo(
    () => (editingPage ? describePageMarks(editingPage) : []),
    [editingPage],
  )

  // A selection outlives neither the mark nor the page it belongs to: removing
  // the selected mark (from the list, or from its own corner button) would
  // otherwise leave an id pointing at nothing.
  useEffect(() => {
    if (selectedMarkId && !marks.some((mark) => mark.id === selectedMarkId)) setSelectedMarkId(null)
  }, [marks, selectedMarkId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedMarkId !== null) setSelectedMarkId(null)
      else if (editorTool !== null) disarm()
      else closeEditor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editorTool, selectedMarkId, disarm, closeEditor])

  if (!editingPage) return null

  return (
    <MarkSelectionContext.Provider value={markSelection}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit page"
          className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden overscroll-contain rounded-2xl border bg-background shadow-xl"
        >
          <header className="flex items-start justify-between gap-4 border-b px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold">Edit page</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add as much as you like — everything is saved to the page as you go.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close editor"
              title="Close editor"
              onClick={closeEditor}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <EditorToolbar
            page={editingPage}
            activeTool={editorTool}
            onSelectTool={setEditorTool}
            zoom={zoom}
            itemsList={{
              open: listOpen,
              count: marks.length,
              toggle: () => setListOpen((open) => !open),
            }}
          />

          <div className="relative flex min-h-0 flex-1">
            {listOpen && (
              // Narrow screens have no room for a column beside the page, so
              // there the list overlays it instead of squeezing it.
              <MarksListPanel
                page={editingPage}
                className="absolute inset-y-0 left-0 z-20 shadow-lg md:static md:z-auto md:shadow-none"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <ActiveTool page={editingPage} tool={editorTool} zoom={zoom.zoom} onDone={disarm} />
            </div>
          </div>
        </div>
      </div>
    </MarkSelectionContext.Provider>
  )
}

function ActiveTool({
  page,
  tool,
  zoom,
  onDone,
}: {
  page: PageDescriptor
  tool: EditorTool | null
  zoom: number
  onDone: () => void
}) {
  // Keyed by page so switching the edited page cannot carry a tool's in-progress
  // state (a half-typed box, a drawn-but-unplaced signature) onto another page.
  switch (tool) {
    case 'text':
      return <TextTool key={page.id} page={page} zoom={zoom} />
    // Sign and image are the two tools that finish by disarming themselves:
    // both end with the mark placed on the page and nothing left to repeat.
    case 'sign':
      return <SignTool key={page.id} page={page} zoom={zoom} onDone={onDone} />
    case 'image':
      return <ImageTool key={page.id} page={page} zoom={zoom} onDone={onDone} />
    case 'highlight':
      return <HighlightTool key={page.id} page={page} zoom={zoom} />
    case 'freehand-highlight':
      return <FreehandTool key={page.id} page={page} zoom={zoom} />
    default:
      return <IdleTool page={page} zoom={zoom} />
  }
}
