import type { UsageHistory } from '../../src/analytics/eventNames'
import { readDailySnapshots } from '../lib/usageStore'

const CACHE_SECONDS = 900
const HISTORY_DAYS = 32

/** Public, cached UTC snapshots used to derive completed daily and weekly totals. */
export default async (): Promise<Response> => {
  let history: UsageHistory = { snapshots: [] }

  try {
    history = { snapshots: await readDailySnapshots(HISTORY_DAYS) }
  } catch {
    // History is decorative; lifetime counters must remain usable on their own.
  }

  return Response.json(history, {
    headers: {
      'cache-control': `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
      'netlify-cdn-cache-control': `public, durable, s-maxage=${CACHE_SECONDS}`,
    },
  })
}
