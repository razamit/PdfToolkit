import { getStore } from '@netlify/blobs'
import type { TrackedEventName, UsageTotals } from '../../src/analytics/eventNames'

const TOTALS_KEY = 'totals'

/**
 * A single increment races against any other in-flight one, and Netlify Blobs
 * has no atomic add — so we retry a compare-and-swap this many times before
 * giving up. Losing a count under a pathological burst is acceptable for a
 * decorative counter; blocking the request is not.
 */
const MAX_INCREMENT_ATTEMPTS = 6

/**
 * Strong consistency is load-bearing, not a tuning knob. `incrementEvent` is a
 * read-modify-write compare-and-swap, and CAS is only sound against a read that
 * reflects the latest write: under the default *eventual* consistency a stale
 * replica makes the conditional check pass against an old value, so overlapping
 * — or even rapid sequential — increments clobber each other instead of adding.
 * Observed in production before this line existed: 18 seed writes collapsed to a
 * single surviving count. Do not drop back to eventual to "speed up" the reads;
 * the public read is CDN-cached anyway, so its latency never reaches a user.
 */
function store() {
  return getStore('usage', { consistency: 'strong' })
}

/** Precomputed lifetime totals, or null before the first event is recorded. */
export async function readTotals(): Promise<UsageTotals | null> {
  return (await store().get(TOTALS_KEY, { type: 'json' })) as UsageTotals | null
}

/**
 * Add one to a single event's lifetime count.
 *
 * All totals live in one blob, so a naive read-modify-write would silently drop
 * increments whenever two requests overlap. This uses optimistic concurrency
 * instead: read the current value with its ETag, write back only if nothing has
 * changed since, and retry the loser of any race. The blob may not exist yet on
 * the very first event, hence the `onlyIfNew` branch.
 */
export async function incrementEvent(name: TrackedEventName): Promise<void> {
  const blobStore = store()

  for (let attempt = 0; attempt < MAX_INCREMENT_ATTEMPTS; attempt += 1) {
    const current = await blobStore.getWithMetadata(TOTALS_KEY, { type: 'json' })
    const totals = (current?.data ?? {}) as UsageTotals
    const next: UsageTotals = { ...totals, [name]: (totals[name] ?? 0) + 1 }

    const result = current
      ? await blobStore.setJSON(TOTALS_KEY, next, { onlyIfMatch: current.etag })
      : await blobStore.setJSON(TOTALS_KEY, next, { onlyIfNew: true })

    if (result.modified) return
  }
}
