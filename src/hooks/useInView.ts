import { useEffect, useState } from 'react'

/**
 * True once the element has scrolled into view, and true forever after.
 *
 * One-way on purpose: entrance animations should play once, not replay every
 * time the user scrolls past.
 *
 * Returns a *callback* ref rather than an object ref. Callers commonly render
 * nothing until their data arrives, so the observed node does not exist on the
 * first render — an effect keyed on `[]` would look at a null ref, bail out, and
 * never run again once the element finally mounted. Storing the node in state
 * re-runs the effect at the moment it attaches.
 */
export function useInView<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  inView: boolean
} {
  const [node, setNode] = useState<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return { ref: setNode, inView }
}
