import { getStore } from '@netlify/blobs'
import type { TrackedEventName, UsageTotals } from '../../src/analytics/eventNames'

const SNAPSHOT_PREFIX = 'snapshot/'
const TOTALS_KEY = 'totals'

function store() {
  return getStore('usage')
}

/**
 * Store one UTC day's event counts.
 *
 * Snapshots are keyed by date rather than folded into a running total, which is
 * what makes the job idempotent: re-running a day overwrites it instead of
 * double-counting, so a retried or manually re-triggered run is always safe.
 */
export async function writeDaySnapshot(day: string, totals: UsageTotals): Promise<void> {
  await store().setJSON(`${SNAPSHOT_PREFIX}${day}`, totals)
}

/**
 * Sum every stored day into lifetime totals.
 *
 * These snapshots — not Umami — are the source of truth for the public counters.
 * Umami Cloud's free tier keeps only six months of history, so querying it for
 * all-time figures would make the counters silently *fall* once the first day
 * aged out. Snapshots are written once and kept forever, so the numbers only
 * ever go up.
 */
export async function sumAllSnapshots(): Promise<UsageTotals> {
  const blobStore = store()
  const { blobs } = await blobStore.list({ prefix: SNAPSHOT_PREFIX })
  const totals: UsageTotals = {}

  for (const blob of blobs) {
    const day = (await blobStore.get(blob.key, { type: 'json' })) as UsageTotals | null
    if (!day) continue
    for (const [name, count] of Object.entries(day)) {
      totals[name as TrackedEventName] = (totals[name as TrackedEventName] ?? 0) + count
    }
  }
  return totals
}

export async function writeTotals(totals: UsageTotals): Promise<void> {
  await store().setJSON(TOTALS_KEY, totals)
}

/** Precomputed lifetime totals, or null before the first snapshot run. */
export async function readTotals(): Promise<UsageTotals | null> {
  return (await store().get(TOTALS_KEY, { type: 'json' })) as UsageTotals | null
}
