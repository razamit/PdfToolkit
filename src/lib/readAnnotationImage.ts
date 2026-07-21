import { loadImage } from './loadImage'
import type { ImageFormat } from '@/domain/types'

/** An image ready to be placed on a page as an annotation. */
export interface AnnotationImage {
  dataUrl: string
  format: ImageFormat
  width: number
  height: number
}

/** MIME types that embed into the export without quality loss. */
const SUPPORTED_TYPES: Record<string, ImageFormat> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
}

/**
 * Read an uploaded or pasted image blob into a data URL plus its natural
 * dimensions. Only JPEG/PNG are accepted — the same lossless-embed guarantee
 * `ImageImportManager` makes for image pages. Annotation images deliberately
 * skip that manager: they are plain bytes owned by their placement, with no
 * source/page/object-URL lifecycle.
 */
export async function readAnnotationImage(blob: Blob): Promise<AnnotationImage> {
  const format = SUPPORTED_TYPES[blob.type.toLowerCase()]
  if (!format) {
    throw new Error('Only JPEG and PNG images can be placed. Other formats would lose quality.')
  }
  const dataUrl = await readBlobAsDataUrl(blob)
  const image = await loadImage(dataUrl)
  return { dataUrl, format, width: image.naturalWidth, height: image.naturalHeight }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}
