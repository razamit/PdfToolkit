import { TRACKED_EVENT_NAMES, type TrackedEventName } from '../../src/analytics/eventNames'
import { incrementEvent } from '../lib/usageStore'

const TRACKED = new Set<string>(TRACKED_EVENT_NAMES)

/**
 * Only the live site feeds the counters. This mirrors, server-side, the guard
 * the old Umami script did with `data-domains`: deploy previews, the raw
 * `.netlify.app` subdomain, and local `netlify dev` must never write into the
 * production totals. Enforcing it here rather than in the browser means a stale
 * client or a hand-rolled request cannot slip past it.
 */
const CANONICAL_HOSTS = new Set(['freepdfmachine.com', 'www.freepdfmachine.com'])

/**
 * Public, unauthenticated write: record one occurrence of a tracked event.
 *
 * Replaces the old Umami-fed snapshot job. The browser posts only an event
 * name — no properties, no identifiers — and an unknown or malformed one is
 * dropped in silence. This endpoint is decorative and must never fail loudly:
 * every path answers 204 so a probe learns nothing and the fire-and-forget
 * client never sees an error.
 */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })

  const host = req.headers.get('host')?.toLowerCase()
  if (!host || !CANONICAL_HOSTS.has(host)) return new Response(null, { status: 204 })

  let name: unknown
  try {
    name = ((await req.json()) as { name?: unknown } | null)?.name
  } catch {
    return new Response(null, { status: 204 })
  }

  if (typeof name === 'string' && TRACKED.has(name)) {
    try {
      await incrementEvent(name as TrackedEventName)
    } catch {
      // A broken counter backend must never surface on a user action.
    }
  }

  return new Response(null, { status: 204 })
}
