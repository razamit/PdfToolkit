import {
  Baseline,
  Highlighter,
  ImagePlus,
  MousePointer2,
  PenLine,
  Type,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorTool, PageDescriptor } from '@/domain/types'
import type { EditorZoom } from './useEditorZoom'

interface ToolSpec {
  tool: EditorTool
  icon: LucideIcon
  label: string
  /** Text-anchored highlighting needs a text layer, which image pages lack. */
  pdfOnly?: boolean
}

const TOOLS: ToolSpec[] = [
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'sign', icon: PenLine, label: 'Sign' },
  { tool: 'image', icon: ImagePlus, label: 'Image' },
  { tool: 'highlight', icon: Baseline, label: 'Highlight text', pdfOnly: true },
  { tool: 'freehand-highlight', icon: Highlighter, label: 'Highlight' },
]

interface EditorToolbarProps {
  page: PageDescriptor
  activeTool: EditorTool | null
  onSelectTool: (tool: EditorTool | null) => void
  zoom: EditorZoom
}

/**
 * Tool strip for the editing session. The tools are radio-like: picking one
 * arms it, picking it again disarms back to the idle "Select" state where
 * placed marks are directly movable. Nothing here closes the session.
 */
export function EditorToolbar({ page, activeTool, onSelectTool, zoom }: EditorToolbarProps) {
  const tools = TOOLS.filter((spec) => !spec.pdfOnly || page.kind === 'pdf')

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Editing tools">
        <ToolButton
          icon={MousePointer2}
          label="Select"
          title="Move and resize what is already on the page"
          active={activeTool === null}
          onClick={() => onSelectTool(null)}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {tools.map((spec) => (
          <ToolButton
            key={spec.tool}
            icon={spec.icon}
            label={spec.label}
            active={activeTool === spec.tool}
            onClick={() => onSelectTool(activeTool === spec.tool ? null : spec.tool)}
          />
        ))}
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Zoom out" disabled={!zoom.canZoomOut} onClick={zoom.zoomOut}>
          <ZoomOut className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={zoom.resetZoom}
          // The visible label is the level, so it would otherwise *be* the
          // accessible name and the title would never be announced.
          aria-label="Reset zoom to fit"
          title="Reset zoom to fit"
          className="min-w-14 rounded-md px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {zoom.label}
        </button>
        <IconButton label="Zoom in" disabled={!zoom.canZoomIn} onClick={zoom.zoomIn}>
          <ZoomIn className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  title,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  title?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
