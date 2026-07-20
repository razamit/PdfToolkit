import { useEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** Tracks an element's content-box size via ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
