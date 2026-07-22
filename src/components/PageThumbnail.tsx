import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { usePageThumbnail } from '@/hooks/usePageThumbnail'
import { useElementSize } from '@/hooks/useElementSize'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { SignatureOverlay } from '@/components/signature/SignatureOverlay'
import { AnnotateMenu } from '@/components/annotations/AnnotateMenu'
import { AnnotationOverlay } from '@/components/annotations/AnnotationOverlay'
import { fitBoxWithin } from '@/lib/signatureGeometry'
import { cn } from '@/lib/utils'
import type { AnnotationTool, PageDescriptor } from '@/domain/types'

interface PageThumbnailProps {
  page: PageDescriptor
  index: number
  targetWidthPx: number
  isSelected: boolean
  onSelect: (id: string, withShift: boolean) => void
  onRotate: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onSign: (id: string) => void
  onAnnotate: (id: string, tool: AnnotationTool) => void
}

function PageThumbnailComponent({
  page,
  index,
  targetWidthPx,
  isSelected,
  onSelect,
  onRotate,
  onRemove,
  onSign,
  onAnnotate,
}: PageThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card transition-shadow',
        isSelected ? 'border-primary ring-2 ring-primary' : 'hover:shadow-md',
        isDragging && 'z-10 opacity-60 shadow-lg',
      )}
    >
      <button
        type="button"
        aria-label={isSelected ? 'Deselect page' : 'Select page'}
        aria-pressed={isSelected}
        onClick={(event) => onSelect(page.id, event.shiftKey)}
        className={cn(
          'absolute left-2 top-2 z-20 flex size-6 items-center justify-center rounded-md border bg-background/90 text-primary shadow-sm backdrop-blur transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {isSelected && <Check className="size-4" strokeWidth={3} />}
      </button>

      <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <ActionButton label="Rotate left" onClick={() => onRotate(page.id, -90)}>
          <RotateCcw className="size-3.5" />
        </ActionButton>
        <ActionButton label="Rotate right" onClick={() => onRotate(page.id, 90)}>
          <RotateCw className="size-3.5" />
        </ActionButton>
        <AnnotateMenu page={page} onSign={onSign} onAnnotate={onAnnotate} />
        <ActionButton label="Remove page" destructive onClick={() => onRemove(page.id)}>
          <Trash2 className="size-3.5" />
        </ActionButton>
      </div>

      <div
        {...attributes}
        {...listeners}
        className="relative flex aspect-square cursor-grab touch-none items-center justify-center overflow-hidden rounded-t-xl bg-muted/40 p-3 active:cursor-grabbing"
      >
        <PageThumbnailContent page={page} targetWidthPx={targetWidthPx} />
        <GripVertical className="pointer-events-none absolute bottom-1.5 left-1/2 size-4 -translate-x-1/2 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-2.5 py-1.5">
        <span className="text-xs font-medium text-foreground">{index + 1}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {page.kind === 'image' ? 'Image' : 'PDF page'}
          {page.exportScale !== undefined && (
            <span title="Scaled to this size at export">
              {' · '}
              {Math.round(page.exportScale * 100)}%
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md border bg-background/90 shadow-sm backdrop-blur transition-colors hover:bg-background',
        destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function PageThumbnailContent({
  page,
  targetWidthPx,
}: {
  page: PageDescriptor
  targetWidthPx: number
}) {
  if (page.kind === 'image') return <ImageThumbnail page={page} />
  return <PdfThumbnail page={page} targetWidthPx={targetWidthPx} />
}

function PdfThumbnail({ page, targetWidthPx }: { page: PageDescriptor; targetWidthPx: number }) {
  const { canvasRef, ready, bitmapSize } = usePageThumbnail({
    sourceId: page.sourceId,
    pageIndex: page.sourcePageIndex,
    rotation: page.rotation,
    targetWidthPx,
  })
  const { ref: areaRef, size: areaSize } = useElementSize<HTMLDivElement>()
  // The wrapper is sized to the bitmap's aspect (which honors intrinsic
  // /Rotate), so the signature overlay coincides exactly with the visible page.
  const fitted =
    ready && bitmapSize && areaSize
      ? fitBoxWithin(areaSize, bitmapSize.width / bitmapSize.height)
      : null
  return (
    <div ref={areaRef} className="flex size-full items-center justify-center">
      {!ready && <div className="absolute inset-3 animate-pulse rounded bg-muted" />}
      <div
        className={cn('relative transition-opacity', fitted ? 'opacity-100' : 'opacity-0')}
        style={fitted ?? { width: '80%', height: '80%' }}
      >
        <canvas ref={canvasRef} className="size-full bg-white shadow-sm" />
        {page.signatures && page.signatures.length > 0 && (
          <SignatureOverlay signatures={page.signatures} frameRotation={page.rotation} />
        )}
        {page.annotations && page.annotations.length > 0 && (
          <AnnotationOverlay
            annotations={page.annotations}
            frameRotation={page.rotation}
            pageSize={{ width: page.width, height: page.height }}
          />
        )}
      </div>
    </div>
  )
}

function ImageThumbnail({ page }: { page: PageDescriptor }) {
  const { imageManager } = usePdfToolkit()
  const { ref: areaRef, size: areaSize } = useElementSize<HTMLDivElement>()
  const url = imageManager.getObjectUrl(page.sourceId)
  if (!url) return null

  // Rotation lives on the wrapper; inside it the frame is rotation-0, which is
  // why the overlay gets frameRotation={0}. The fit accounts for the rotated
  // footprint so sideways images stay inside the cell.
  const sideways = page.rotation === 90 || page.rotation === 270
  const fitted = areaSize
    ? fitBoxWithin(
        sideways ? { width: areaSize.height, height: areaSize.width } : areaSize,
        page.width / page.height,
      )
    : null
  return (
    <div ref={areaRef} className="flex size-full items-center justify-center">
      {fitted && (
        <div
          className="relative transition-transform"
          style={{ ...fitted, transform: `rotate(${page.rotation}deg)` }}
        >
          <img src={url} alt="" draggable={false} className="size-full bg-white shadow-sm" />
          {page.signatures && page.signatures.length > 0 && (
            <SignatureOverlay signatures={page.signatures} frameRotation={0} />
          )}
          {page.annotations && page.annotations.length > 0 && (
            <AnnotationOverlay
              annotations={page.annotations}
              frameRotation={0}
              pageSize={{ width: page.width, height: page.height }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export const PageThumbnail = memo(PageThumbnailComponent)
