import type { ImageFormat } from '@/domain/types'

/**
 * Image format detection from the file's own bytes.
 *
 * A file's MIME type comes from its extension, not its content, so a PNG saved
 * as `photo.jpeg` reports `image/jpeg`. The browser sniffs the content and
 * displays it anyway, which hides the mismatch until export, where the JPEG
 * embedder rejects the bytes with "SOI not found in JPEG". The signature is the
 * only trustworthy answer to "which embedder can take these bytes".
 */

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Longest signature above: how many leading bytes detection needs. */
const SIGNATURE_BYTE_LENGTH = PNG_SIGNATURE.length

export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/** The embeddable format these bytes really are, or `null` for anything else. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWithSignature(bytes, JPEG_SIGNATURE)) return 'jpeg'
  if (startsWithSignature(bytes, PNG_SIGNATURE)) return 'png'
  return null
}

/** `detectImageFormat` for a blob, reading only its leading bytes. */
export async function detectBlobImageFormat(blob: Blob): Promise<ImageFormat | null> {
  const header = await blob.slice(0, SIGNATURE_BYTE_LENGTH).arrayBuffer()
  return detectImageFormat(new Uint8Array(header))
}

function startsWithSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}
