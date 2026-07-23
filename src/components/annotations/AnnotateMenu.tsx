import { useEffect, useRef, useState } from 'react'
import {
  Baseline,
  Highlighter,
  ImagePlus,
  Move,
  PenLine,
  SquarePen,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { AnnotationTool, PageDescriptor } from '@/domain/types'

interface AnnotateMenuProps {
  page: PageDescriptor
  onSign: (pageId: string) => void
  onAnnotate: (pageId: string, tool: AnnotationTool) => void
}

/**
 * Hover-bar popover listing the per-page annotation actions. There are two
 * highlighters: "Highlight text" is text-aware and offered only for PDF pages
 * (image pages have no text), while the free-hand "Highlight" is drawn directly
 * on the page and works on both PDF and image pages.
 */
export function AnnotateMenu({ page, onSign, onAnnotate }: AnnotateMenuProps) {
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

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Annotate page"
        title="Annotate page"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex size-7 items-center justify-center rounded-md border bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
      >
        <SquarePen className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border bg-background py-1 shadow-md">
          <MenuItem icon={PenLine} label="Sign" onClick={() => choose(() => onSign(page.id))} />
          <MenuItem
            icon={Type}
            label="Add text"
            onClick={() => choose(() => onAnnotate(page.id, 'text'))}
          />
          <MenuItem
            icon={ImagePlus}
            label="Add image"
            onClick={() => choose(() => onAnnotate(page.id, 'image'))}
          />
          {page.kind === 'pdf' && (
            <MenuItem
              icon={Baseline}
              label="Highlight text"
              onClick={() => choose(() => onAnnotate(page.id, 'highlight'))}
            />
          )}
          <MenuItem
            icon={Highlighter}
            label="Highlight"
            onClick={() => choose(() => onAnnotate(page.id, 'freehand-highlight'))}
          />
          {hasPlacedMarks(page) && (
            <MenuItem
              icon={Move}
              label="Move & resize"
              onClick={() => choose(() => onAnnotate(page.id, 'arrange'))}
            />
          )}
        </div>
      )}
    </div>
  )
}

function hasPlacedMarks(page: PageDescriptor): boolean {
  return (page.signatures?.length ?? 0) > 0 || (page.annotations?.length ?? 0) > 0
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      {label}
    </button>
  )
}
