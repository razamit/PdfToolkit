import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readAnnotationImage, type AnnotationImage } from '@/lib/readAnnotationImage'

interface ImagePickStepProps {
  /** Ends the whole editing session (the footer's corner button). */
  onClose: () => void
  onPlace: (image: AnnotationImage) => void
}

/**
 * First image-annotation step: pick the image to place, by file upload or by
 * pasting from the clipboard. Upload is the always-reliable path; paste works
 * wherever the browser exposes image clipboard items.
 */
export function ImagePickStep({ onClose, onPlace }: ImagePickStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [picked, setPicked] = useState<AnnotationImage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readBlob = async (blob: Blob) => {
    try {
      setPicked(await readAnnotationImage(blob))
      setError(null)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'The image could not be read.')
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/'),
      )
      const blob = item?.getAsFile()
      if (blob) void readBlob(blob)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-muted/30 p-6">
        {picked ? (
          <img
            src={picked.dataUrl}
            alt="Image to place"
            className="max-h-[45dvh] max-w-full rounded-md border bg-white object-contain shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <ImagePlus className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Upload a JPEG or PNG, or paste one from the clipboard.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            {picked ? 'Choose another' : 'Upload image'}
          </Button>
          <span className="text-xs text-muted-foreground">or press ⌘V to paste</span>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readBlob(file)
            event.target.value = ''
          }}
        />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p className="text-xs text-muted-foreground">
          The image lands centered on the page — move and resize it there.
        </p>
        <div className="flex gap-2">
          <Button disabled={!picked} onClick={() => picked && onPlace(picked)}>
            Save
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </footer>
    </div>
  )
}
