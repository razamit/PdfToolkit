import { useEffect, useState } from 'react'
import { loadImage } from '@/lib/loadImage'
import type { Rotation } from '@/domain/types'

const CACHE_LIMIT = 40

/** Module-level memo of rotated PNGs, keyed by delta + source data URL (LRU-ish). */
const rotatedPngCache = new Map<string, string>()

/** Data URL of the signature PNG rotated clockwise by `delta` degrees. */
export function useRotatedSignaturePng(pngDataUrl: string, delta: Rotation): string | null {
  const [rotatedUrl, setRotatedUrl] = useState<string | null>(() =>
    delta === 0 ? pngDataUrl : (rotatedPngCache.get(`${delta}:${pngDataUrl}`) ?? null),
  )

  useEffect(() => {
    if (delta === 0) {
      setRotatedUrl(pngDataUrl)
      return
    }
    const key = `${delta}:${pngDataUrl}`
    const cached = rotatedPngCache.get(key)
    if (cached) {
      setRotatedUrl(cached)
      return
    }
    let alive = true
    rotatePng(pngDataUrl, delta)
      .then((url) => {
        storeInCache(key, url)
        if (alive) setRotatedUrl(url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [pngDataUrl, delta])

  return rotatedUrl
}

async function rotatePng(pngDataUrl: string, delta: Rotation): Promise<string> {
  const image = await loadImage(pngDataUrl)
  const sideways = delta === 90 || delta === 270
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? image.naturalHeight : image.naturalWidth
  canvas.height = sideways ? image.naturalWidth : image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable.')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((delta * Math.PI) / 180)
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
  return canvas.toDataURL('image/png')
}

function storeInCache(key: string, url: string): void {
  rotatedPngCache.delete(key)
  rotatedPngCache.set(key, url)
  while (rotatedPngCache.size > CACHE_LIMIT) {
    const oldestKey = rotatedPngCache.keys().next().value
    if (oldestKey === undefined) break
    rotatedPngCache.delete(oldestKey)
  }
}
