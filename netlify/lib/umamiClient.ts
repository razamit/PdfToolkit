import { TRACKED_EVENT_NAMES, type TrackedEventName } from '../../src/analytics/eventNames'

/** Umami's metrics rows: `x` is the event name, `y` its count in the range. */
interface UmamiMetricRow {
  x: string
  y: number
}

const DEFAULT_API_BASE = 'https://api.umami.is/v1'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

/**
 * Total occurrences of each tracked event between two Unix-ms timestamps.
 *
 * Events we do not recognise are dropped rather than stored: the counters are a
 * public display, and anything Umami reports that the app did not deliberately
 * send has no business appearing there.
 */
export async function fetchEventTotals(
  startAt: number,
  endAt: number,
): Promise<Partial<Record<TrackedEventName, number>>> {
  const websiteId = requireEnv('UMAMI_WEBSITE_ID')
  const apiKey = requireEnv('UMAMI_API_KEY')
  const base = process.env.UMAMI_API_BASE ?? DEFAULT_API_BASE

  const url = new URL(`${base}/websites/${websiteId}/metrics`)
  url.searchParams.set('type', 'event')
  url.searchParams.set('startAt', String(startAt))
  url.searchParams.set('endAt', String(endAt))

  const response = await fetch(url, {
    headers: { accept: 'application/json', 'x-umami-api-key': apiKey },
  })
  if (!response.ok) {
    throw new Error(`Umami responded ${response.status} ${response.statusText}`)
  }

  const rows = (await response.json()) as UmamiMetricRow[]
  const known = new Set<string>(TRACKED_EVENT_NAMES)
  const totals: Partial<Record<TrackedEventName, number>> = {}
  for (const row of rows) {
    if (known.has(row.x)) totals[row.x as TrackedEventName] = row.y
  }
  return totals
}
