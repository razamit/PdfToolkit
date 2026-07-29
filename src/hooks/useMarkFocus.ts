import { useEffect, useRef } from 'react'

/**
 * Ref for a placed mark that brings itself into view when it becomes the
 * selected one, so picking a row in the items list reveals its mark even when
 * the page is zoomed past the visible area.
 *
 * `block: 'nearest'` is deliberate: it scrolls the minimum needed and does
 * nothing at all when the mark is already visible, which is the common case at
 * fit-to-screen zoom where no ancestor scrolls anyway.
 */
export function useMarkFocus<T extends HTMLElement>(selected: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!selected) return
    ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [selected])

  return ref
}
