import { useEffect, useRef, useState } from 'react'
import { Scaling } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { Button } from './ui/button'
import type { PageSizeMode } from '@/domain/types'

const RESIZE_CHOICES: Array<{ preset: PageSizeMode; label: string }> = [
  { preset: 'match', label: 'Match document' },
  { preset: 'a4', label: 'Fit to A4' },
  { preset: 'letter', label: 'Fit to Letter' },
  { preset: 'original', label: 'Original size' },
]

/**
 * Bulk-bar dropdown that sets the export size of the selected pages. Sizing is
 * aspect-preserving, so this only changes how large each page comes out in the
 * exported PDF — thumbnails keep their shape and show a percent badge.
 */
export function ResizeMenu({ pageIds }: { pageIds: string[] }) {
  const { resizePages } = usePdfToolkit()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = (preset: PageSizeMode) => {
    setOpen(false)
    resizePages(pageIds, preset)
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-label="Resize pages"
        onClick={() => setOpen((previous) => !previous)}
      >
        <Scaling />
        <span className="hidden sm:inline">Resize</span>
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-40 overflow-hidden rounded-md border bg-background py-1 shadow-md">
          {RESIZE_CHOICES.map((choice) => (
            <button
              key={choice.preset}
              type="button"
              onClick={() => choose(choice.preset)}
              className="w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
