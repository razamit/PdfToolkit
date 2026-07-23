import { useEffect, useRef } from 'react'

/**
 * Publishes an element's border-box height as a CSS custom property on `:root`,
 * so unrelated fixed/sticky elements can offset themselves against it without
 * hard-coding a pixel value that breaks when the element wraps or grows.
 */
export function useCssHeightVariable<T extends HTMLElement>(variableName: string) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const publish = () => {
      root.style.setProperty(variableName, `${element.getBoundingClientRect().height}px`)
    }

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(variableName)
    }
  }, [variableName])

  return ref
}
