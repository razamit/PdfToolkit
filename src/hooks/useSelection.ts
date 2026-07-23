import { useCallback, useEffect, useRef, useState } from 'react'

export interface Selection {
  selectedIds: ReadonlySet<string>
  isSelected: (id: string) => boolean
  count: number
  toggle: (id: string) => void
  /** Select the contiguous range between the last anchor and `id` (shift-click). */
  selectRange: (id: string) => void
  /** Replace the whole selection with exactly `ids` (e.g. all of one file's pages). */
  setSelection: (ids: string[]) => void
  selectAll: () => void
  clear: () => void
}

/**
 * Multi-select state for bulk operations. Tracks an anchor so shift-clicking
 * selects a contiguous range, and prunes ids that leave the ordered list (e.g.
 * after their pages are deleted).
 */
export function useSelection(orderedIds: string[]): Selection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const anchorRef = useRef<string | null>(null)

  useEffect(() => {
    setSelectedIds((prev) => {
      const present = new Set(orderedIds)
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (present.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [orderedIds])

  const toggle = useCallback((id: string) => {
    anchorRef.current = id
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectRange = useCallback(
    (id: string) => {
      const anchor = anchorRef.current
      if (anchor === null) {
        anchorRef.current = id
        setSelectedIds((prev) => new Set(prev).add(id))
        return
      }
      const from = orderedIds.indexOf(anchor)
      const to = orderedIds.indexOf(id)
      if (from === -1 || to === -1) return
      const [lo, hi] = from < to ? [from, to] : [to, from]
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (let i = lo; i <= hi; i += 1) next.add(orderedIds[i])
        return next
      })
    },
    [orderedIds],
  )

  const setSelection = useCallback((ids: string[]) => {
    anchorRef.current = ids.length > 0 ? ids[ids.length - 1] : null
    setSelectedIds(new Set(ids))
  }, [])

  const selectAll = useCallback(() => setSelectedIds(new Set(orderedIds)), [orderedIds])
  const clear = useCallback(() => setSelectedIds(new Set()), [])

  return {
    selectedIds,
    isSelected: (id) => selectedIds.has(id),
    count: selectedIds.size,
    toggle,
    selectRange,
    setSelection,
    selectAll,
    clear,
  }
}
