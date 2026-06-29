import { useRef, type ComponentProps, type ReactNode } from 'react'
import { Button } from './ui/button'

interface FileInputButtonProps {
  accept: string
  onFiles: (files: FileList) => void
  children: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  disabled?: boolean
}

/** A button that opens the native file picker and forwards the chosen files. */
export function FileInputButton({
  accept,
  onFiles,
  children,
  variant = 'outline',
  disabled,
}: FileInputButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          const { files } = event.target
          if (files && files.length > 0) onFiles(files)
          // Reset so selecting the same file again still fires onChange.
          event.target.value = ''
        }}
      />
    </>
  )
}
