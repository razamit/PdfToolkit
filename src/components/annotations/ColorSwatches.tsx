import { cn } from '@/lib/utils'

interface ColorSwatchesProps {
  colors: readonly string[]
  colorHex: string
  onChange: (color: string) => void
  label?: string
}

/**
 * A radiogroup of round colour swatches, shared by the annotation dialogs.
 * The selected swatch carries the indigo focus ring.
 */
export function ColorSwatches({
  colors,
  colorHex,
  onChange,
  label = 'Highlight color',
}: ColorSwatchesProps) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === colorHex}
          aria-label={`${label} ${color}`}
          title={color}
          onClick={() => onChange(color)}
          className={cn(
            'size-6 rounded-full border transition-shadow',
            color === colorHex && 'ring-2 ring-primary ring-offset-2',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}
