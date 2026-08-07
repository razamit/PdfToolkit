/**
 * A file-type badge: a document sheet with a folded corner, tinted per format,
 * with the extension set inside it.
 *
 * Why not the real Adobe / Microsoft marks, which is what "PDF, Excel and Word
 * icons" usually means: those are trademarked logos, and putting them on a
 * product that competes with their owners' tools implies an endorsement that
 * does not exist. Drawing our own sheet and colouring it the way people already
 * associate with each format — red for PDF, green for spreadsheets, blue for
 * Word — gets the same instant recognition with none of that.
 *
 * The per-format colours are a deliberate, bounded exception to the single
 * indigo accent, on the same grounds as the source-colour palette of decision
 * row 10: the colour *encodes which format this is*, so it has to differ
 * between items. It appears nowhere but these badges.
 */

export interface FileTypeBadgeProps {
  /** Shown inside the sheet. Kept to four characters so it stays legible. */
  extension: string
  /** Base colour for the sheet outline, fold and label. */
  color: string
  className?: string
}

export function FileTypeBadge({ extension, color, className }: FileTypeBadgeProps) {
  return (
    <svg
      viewBox="0 0 28 34"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
      style={{ color }}
    >
      {/* Sheet, with the top-right corner cut away for the fold. */}
      <path
        d="M3.5 1.5h13.5L26.5 11v21.5a1.5 1.5 0 0 1-1.5 1.5H3.5A1.5 1.5 0 0 1 2 32.5v-30A1.5 1.5 0 0 1 3.5 1.5Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* The fold itself, drawn solid so the corner reads as turned over. */}
      <path
        d="M17 1.5V9.5a1.5 1.5 0 0 0 1.5 1.5h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="14"
        y="26"
        textAnchor="middle"
        fill="currentColor"
        // Set in the UI font at a size that stays readable at 28px wide; the
        // tight letter-spacing keeps four characters inside the sheet.
        style={{ font: '700 8.5px Inter, ui-sans-serif, system-ui, sans-serif', letterSpacing: '-0.02em' }}
      >
        {extension}
      </text>
    </svg>
  )
}
