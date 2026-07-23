import { useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { Button } from '@/components/ui/button'
import { AnnotationModalShell } from '@/components/annotations/AnnotationModalShell'
import { PreviewSurface } from '@/components/annotations/PreviewSurface'
import { ExistingMarksOverlay } from '@/components/annotations/ExistingMarksOverlay'
import { ColorSwatches } from '@/components/annotations/ColorSwatches'
import { cn } from '@/lib/utils'
import type { PageDescriptor } from '@/domain/types'
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_HIGHLIGHT_THICKNESS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_THICKNESSES,
} from '@/lib/annotationStyles'
import { HighlightInkSvg } from '@/components/freehand/HighlightInkSvg'
import { useFreehandStrokes, type FreehandMode } from './useFreehandStrokes'

/**
 * Free-hand highlighter dialog: draw directly over the page — free-hand to
 * follow the pointer, or straight-line to drag a bar. Several marks can be
 * added before closing with Done. Works on PDF and image pages alike (no text
 * dependency), so scanned pages become highlightable for the first time.
 */
export function FreehandHighlightModal() {
  const { annotatingPage } = usePdfToolkit()
  if (!annotatingPage) return null
  return <FreehandModalContent page={annotatingPage} />
}

function FreehandModalContent({ page }: { page: PageDescriptor }) {
  const { cancelAnnotate, addAnnotation } = usePdfToolkit()
  const [colorHex, setColorHex] = useState(DEFAULT_HIGHLIGHT_COLOR)
  const [thickness, setThickness] = useState(DEFAULT_HIGHLIGHT_THICKNESS)
  const [mode, setMode] = useState<FreehandMode>('freehand')
  const { strokes, hasInk, handlers, undo, clear } = useFreehandStrokes(mode)

  const handleAdd = () => {
    if (!hasInk) return
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'freehand-highlight',
      strokes,
      colorHex,
      thickness,
      rotationAtCreate: page.rotation,
    })
    clear()
  }

  return (
    <AnnotationModalShell
      title="Highlight"
      subtitle="Draw over the page to highlight — free-hand, or a straight line."
      onClose={cancelAnnotate}
    >
      <div className="flex min-h-0 flex-col">
        <PreviewSurface page={page}>
          {({ fittedSize }) => (
            <>
              {/* Layering relies on DOM order (positioned siblings, no z-index):
                  a z-index would give a layer its own stacking context and break
                  the ink's mix-blend-multiply against the page canvas. The capture
                  layer sits first (visually bottom) but receives every pointer
                  event because the overlays above it are pointer-events-none. */}
              <div
                {...handlers}
                className="absolute inset-0 touch-none cursor-crosshair"
              />
              <ExistingMarksOverlay page={page} />
              <HighlightInkSvg
                strokes={strokes}
                colorHex={colorHex}
                thickness={thickness}
                surface={fittedSize}
              />
            </>
          )}
        </PreviewSurface>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <ColorSwatches colors={HIGHLIGHT_COLORS} colorHex={colorHex} onChange={setColorHex} />
            <ThicknessSelector thickness={thickness} onChange={setThickness} />
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={!hasInk} onClick={undo}>
              Undo
            </Button>
            <Button variant="ghost" disabled={!hasInk} onClick={clear}>
              Clear
            </Button>
            <Button variant="outline" onClick={cancelAnnotate}>
              Done
            </Button>
            <Button disabled={!hasInk} onClick={handleAdd}>
              Add highlight
            </Button>
          </div>
        </footer>
      </div>
    </AnnotationModalShell>
  )
}

function ThicknessSelector({
  thickness,
  onChange,
}: {
  thickness: number
  onChange: (thickness: number) => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-md border p-0.5"
      role="radiogroup"
      aria-label="Highlight thickness"
    >
      {HIGHLIGHT_THICKNESSES.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={option.fraction === thickness}
          title={`${option.label} thickness`}
          onClick={() => onChange(option.fraction)}
          className={cn(
            'flex size-6 items-center justify-center rounded text-xs font-medium transition-colors',
            option.fraction === thickness
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: FreehandMode
  onChange: (mode: FreehandMode) => void
}) {
  const options: { value: FreehandMode; label: string }[] = [
    { value: 'freehand', label: 'Free' },
    { value: 'line', label: 'Line' },
  ]
  return (
    <div
      className="flex items-center gap-1 rounded-md border p-0.5"
      role="radiogroup"
      aria-label="Highlight mode"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === mode}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            option.value === mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
