import { createId } from '@/lib/id'
import { IMAGE_MIME_TYPES, detectImageFormat } from '@/lib/imageFormat'
import { SourceLoadError } from '@/domain/errors'
import type { ImageFormat, PageDescriptor, SourceMeta } from '@/domain/types'

interface LoadedImage {
  meta: SourceMeta
  /** Display URL backed by the original bytes (revoked on remove/reset). */
  objectUrl: string
}

export interface ImageLoadResult {
  meta: SourceMeta
  page: PageDescriptor
  objectUrl: string
}

/**
 * Ingests JPEG/PNG images and owns their display object URLs.
 *
 * Only JPEG and PNG are accepted because their bytes can be embedded into the
 * exported PDF without re-encoding (JPEG is byte-identical; PNG is re-encoded
 * via lossless Flate but pixel-identical). Anything else is rejected so the
 * "original quality" guarantee is never silently broken.
 *
 * The format is read from the bytes, not from `file.type`: that only echoes the
 * extension, and a PNG named `.jpeg` would otherwise reach the JPEG embedder at
 * export and fail there.
 */
export class ImageImportManager {
  private readonly loaded = new Map<string, LoadedImage>()

  async load(file: File): Promise<ImageLoadResult> {
    const originalBytes = new Uint8Array(await file.arrayBuffer())
    const format = this.resolveFormat(file, originalBytes)
    const objectUrl = URL.createObjectURL(
      new Blob([originalBytes], { type: IMAGE_MIME_TYPES[format] }),
    )
    const { width, height } = await this.readDimensions(objectUrl, file.name)

    const id = createId('img')
    const meta: SourceMeta = {
      id,
      kind: 'image',
      name: file.name,
      originalBytes,
      pageCount: 1,
      imageFormat: format,
    }
    this.loaded.set(id, { meta, objectUrl })

    const page: PageDescriptor = {
      id: createId('page'),
      sourceId: id,
      kind: 'image',
      sourcePageIndex: 0,
      rotation: 0,
      width,
      height,
    }
    return { meta, page, objectUrl }
  }

  getObjectUrl(sourceId: string): string | undefined {
    return this.loaded.get(sourceId)?.objectUrl
  }

  getMeta(sourceId: string): SourceMeta | undefined {
    return this.loaded.get(sourceId)?.meta
  }

  remove(sourceId: string): void {
    const entry = this.loaded.get(sourceId)
    if (!entry) return
    URL.revokeObjectURL(entry.objectUrl)
    this.loaded.delete(sourceId)
  }

  destroyAll(): void {
    for (const { objectUrl } of this.loaded.values()) URL.revokeObjectURL(objectUrl)
    this.loaded.clear()
  }

  private resolveFormat(file: File, bytes: Uint8Array): ImageFormat {
    const format = detectImageFormat(bytes)
    if (!format) {
      throw new SourceLoadError(
        `"${file.name}" isn't a JPEG or PNG. Only those formats can be added without quality loss.`,
      )
    }
    return format
  }

  private readDimensions(url: string, name: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new SourceLoadError(`"${name}" could not be read as an image.`))
      img.src = url
    })
  }
}
