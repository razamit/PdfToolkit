import { createContext, useContext } from 'react'

export interface MarkSelectionValue {
  /** Id of the mark currently picked out for editing, or null when none is. */
  selectedMarkId: string | null
  /** Pick a mark out (or clear with null); the page rings it and scrolls to it. */
  selectMark: (markId: string | null) => void
}

/**
 * Selection is *not* in the coordinator: it is session-scoped view state, not
 * part of the document, and putting it there would re-render the whole page
 * grid on every click in the items list.
 *
 * It is a context rather than props because `ExistingMarksOverlay` is rendered
 * by five separate tools, so props would have to be threaded through all of
 * them plus `ActiveTool` just to reach the same two values.
 */
const NO_SELECTION: MarkSelectionValue = { selectedMarkId: null, selectMark: () => {} }

export const MarkSelectionContext = createContext<MarkSelectionValue>(NO_SELECTION)

/**
 * Marks outside an editing session (the page thumbnails) have no selection, so
 * this falls back to an inert value instead of throwing — being selectable is
 * an editor capability, not a requirement of rendering a mark.
 */
export function useMarkSelection(): MarkSelectionValue {
  return useContext(MarkSelectionContext)
}
