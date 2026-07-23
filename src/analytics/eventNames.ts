/**
 * Canonical event names — the contract shared by three places that must agree:
 * the browser tracker, the `/api/track` increment function, and the counters UI.
 *
 * Kept dependency-free on purpose so the Netlify functions can import it directly
 * and the backend can never drift from what the client actually sends.
 *
 * Renaming an entry orphans its historical count in the stored totals. Add a new
 * name instead, and retire the old one once it has aged out.
 */
export const TRACKED_EVENT_NAMES = [
  'file-added',
  'pages-removed',
  'pages-rotated',
  'pages-resized',
  'pages-reordered',
  'signature-added',
  'annotation-added',
  'pdf-exported',
] as const

export type TrackedEventName = (typeof TRACKED_EVENT_NAMES)[number]

/** Totals keyed by event name, as served by the counters endpoint. */
export type UsageTotals = Partial<Record<TrackedEventName, number>>
