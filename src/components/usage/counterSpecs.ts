import {
  FileDown,
  FileUp,
  RotateCw,
  Scaling,
  Shuffle,
  Signature,
  Stamp,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { TrackedEventName } from '@/analytics/eventNames'

export interface CounterSpec {
  name: TrackedEventName
  label: string
  Icon: LucideIcon
}

/**
 * What each tracked event is called on the counters panel, in display order —
 * the headline number first, incidental page-shuffling last.
 *
 * Typed against `TrackedEventName` so a renamed or removed event breaks the
 * build here rather than quietly rendering a permanent zero.
 */
export const COUNTER_SPECS: readonly CounterSpec[] = [
  { name: 'pdf-exported', label: 'PDFs built', Icon: FileDown },
  { name: 'file-added', label: 'Files fed in', Icon: FileUp },
  { name: 'annotation-added', label: 'Marks stamped', Icon: Stamp },
  { name: 'signature-added', label: 'Signatures inked', Icon: Signature },
  { name: 'pages-rotated', label: 'Pages spun', Icon: RotateCw },
  { name: 'pages-resized', label: 'Pages resized', Icon: Scaling },
  { name: 'pages-reordered', label: 'Shuffles', Icon: Shuffle },
  { name: 'pages-removed', label: 'Pages scrapped', Icon: Trash2 },
]
