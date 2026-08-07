import { FileTypeBadge } from './FileTypeBadge'

/**
 * The formats the machine accepts, shown as recognisable file-type badges under
 * the picker rather than as separate buttons.
 *
 * This is the readable half of collapsing four "Add …" buttons into one: the
 * picker stops asking which category a file belongs to, and this row answers
 * the only question that mattered — "will it take my file?" — with nothing to
 * click and nothing to get wrong.
 */

interface SupportedFormat {
  extension: string
  color: string
  label: string
  detail: string
}

/**
 * Colours are the ones each format is already associated with, so the row is
 * scannable without reading it. Held at roughly the 600 level so they sit on
 * white beside the indigo primary without competing with it.
 */
const FORMATS: SupportedFormat[] = [
  { extension: 'PDF', color: '#dc2626', label: 'PDF', detail: '.pdf' },
  { extension: 'IMG', color: '#7c3aed', label: 'Images', detail: '.jpg .png' },
  // Deliberately XLSX and DOCX, not XLS and DOC: the legacy binary formats are
  // the ones the importer *rejects* by name, so labelling the badges with them
  // would promise the exact thing that fails.
  { extension: 'XLSX', color: '#16a34a', label: 'Spreadsheets', detail: '.csv .xlsx' },
  { extension: 'DOCX', color: '#2563eb', label: 'Word', detail: '.docx' },
]

export function SupportedFormats({ className }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-start justify-center gap-x-7 gap-y-4 ${className ?? ''}`}
      aria-label="Supported file formats"
    >
      {FORMATS.map((format) => (
        <li key={format.label} className="flex w-20 flex-col items-center gap-1.5">
          <FileTypeBadge
            extension={format.extension}
            color={format.color}
            className="h-8 w-auto shrink-0"
          />
          <span className="text-xs font-medium leading-none text-foreground/75">
            {format.label}
          </span>
          {/* The extensions are what someone actually checks their own file
              against; the category name alone is ambiguous (.xls is not .xlsx). */}
          <span className="text-[11px] leading-none text-muted-foreground">{format.detail}</span>
        </li>
      ))}
    </ul>
  )
}
