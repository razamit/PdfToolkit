/** Trigger a browser download of the given PDF bytes. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Defer revocation so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
