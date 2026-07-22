import type { Config } from '@netlify/functions'
import { dayBounds, recentDayKeys } from '../lib/days'
import { fetchEventTotals } from '../lib/umamiClient'
import { sumAllSnapshots, writeDaySnapshot, writeTotals } from '../lib/usageStore'

/**
 * Nightly job: copy Umami's per-day event counts into durable storage.
 *
 * Three days are re-snapshotted each run, not one. Snapshots are idempotent, so
 * the cost is two extra API calls and the benefit is that a missed or failed
 * night heals itself on the next run instead of leaving a permanent hole in the
 * lifetime totals.
 */
const DEFAULT_DAYS = 3

/** Umami allows 50 API calls per 15s; a capped backfill stays well inside that. */
const MAX_BACKFILL_DAYS = 30

function resolveDayCount(url: URL): number {
  const requested = Number(url.searchParams.get('backfill'))
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_DAYS
  return Math.min(Math.trunc(requested), MAX_BACKFILL_DAYS)
}

export default async (req: Request): Promise<Response> => {
  const days = recentDayKeys(resolveDayCount(new URL(req.url)), new Date())
  const snapshotted: string[] = []

  try {
    for (const day of days) {
      const { startAt, endAt } = dayBounds(day)
      await writeDaySnapshot(day, await fetchEventTotals(startAt, endAt))
      snapshotted.push(day)
    }
    const totals = await sumAllSnapshots()
    await writeTotals(totals)
    return Response.json({ ok: true, snapshotted, totals })
  } catch (error) {
    // Partial progress is kept: days already written stay written, and the next
    // run re-covers them anyway.
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message, snapshotted }, { status: 500 })
  }
}

/**
 * Hourly rather than daily: the counters can only be as fresh as this job, so a
 * daily schedule meant a visitor could see a full day of activity missing. At 3
 * Umami calls per run this is 72 calls/day against a 50-per-15-seconds limit,
 * and ~720 invocations/month against Netlify's 125k free tier — negligible on
 * both. Change back to '@daily' if either ever becomes a concern.
 */
export const config: Config = { schedule: '@hourly' }
