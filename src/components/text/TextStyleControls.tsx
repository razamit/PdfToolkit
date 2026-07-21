import { cn } from '@/lib/utils'
import { TEXT_COLORS, TEXT_FONT_SIZES_PT } from '@/lib/annotationStyles'

interface TextStyleControlsProps {
  fontSizePt: number
  colorHex: string
  onFontSizeChange: (fontSizePt: number) => void
  onColorChange: (colorHex: string) => void
}

/** Font-size select and color swatches for the text annotation modal. */
export function TextStyleControls({
  fontSizePt,
  colorHex,
  onFontSizeChange,
  onColorChange,
}: TextStyleControlsProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Size
        <select
          value={fontSizePt}
          onChange={(event) => onFontSizeChange(Number(event.target.value))}
          className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
        >
          {TEXT_FONT_SIZES_PT.map((size) => (
            <option key={size} value={size}>
              {size} pt
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Text color">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={color === colorHex}
            aria-label={`Text color ${color}`}
            title={color}
            onClick={() => onColorChange(color)}
            className={cn(
              'size-6 rounded-full border transition-shadow',
              color === colorHex && 'ring-2 ring-primary ring-offset-2',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}
