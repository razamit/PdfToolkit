import { useCallback, useRef, useState, type DragEvent } from 'react'

/**
 * Drag-and-drop plumbing for a drop target. Uses an enter/leave depth counter
 * so dragging over child elements doesn't flicker the highlighted state.
 */
export function useFileUpload(onFiles: (files: FileList | File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)
  const depthRef = useRef(0)

  const onDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault()
    depthRef.current += 1
    setIsDragging(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault()
    depthRef.current -= 1
    if (depthRef.current <= 0) {
      depthRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      depthRef.current = 0
      setIsDragging(false)
      const files = event.dataTransfer?.files
      if (files && files.length > 0) onFiles(files)
    },
    [onFiles],
  )

  return {
    isDragging,
    dropzoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
