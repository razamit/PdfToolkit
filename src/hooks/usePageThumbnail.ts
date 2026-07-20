import { useEffect, useRef, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { Rotation } from '@/domain/types'

interface UsePageThumbnailParams {
  sourceId: string
  pageIndex: number
  rotation: Rotation
  targetWidthPx: number
}

/**
 * Lazily renders a PDF page thumbnail onto a canvas once it scrolls near the
 * viewport (IntersectionObserver), and re-renders when rotation or zoom level
 * changes. The in-flight render is aborted if the cell unmounts mid-render.
 * Bitmaps are owned by the render manager's cache — never closed here.
 */
export function usePageThumbnail({
  sourceId,
  pageIndex,
  rotation,
  targetWidthPx,
}: UsePageThumbnailParams) {
  const { thumbnailRenderer } = usePdfToolkit()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [bitmapSize, setBitmapSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    let alive = true
    setReady(false)

    thumbnailRenderer
      .render({ sourceId, pageIndex, rotation, targetWidthPx }, controller.signal)
      .then((bitmap) => {
        const canvas = canvasRef.current
        if (!alive || !bitmap || !canvas) return
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
        setBitmapSize({ width: bitmap.width, height: bitmap.height })
        setReady(true)
      })
      .catch(() => {})

    return () => {
      alive = false
      controller.abort()
    }
  }, [visible, sourceId, pageIndex, rotation, targetWidthPx, thumbnailRenderer])

  return { canvasRef, ready, bitmapSize }
}
