/** Trigger a browser download of the given PDF bytes. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  downloadBlob(
    new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
  )
}

/** Trigger a browser download for any generated client-side artifact. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Defer revocation so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
