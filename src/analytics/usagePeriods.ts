import {
  TRACKED_EVENT_NAMES,
  type UsageSnapshot,
  type UsageTotals,
} from './eventNames'

const DAY_MS = 24 * 60 * 60 * 1000

export type UsagePeriodName = 'lifetime' | 'daily' | 'weekly'

export interface UsagePeriod {
  label: string
  totals: UsageTotals
}

export interface UsagePeriods {
  lifetime: UsagePeriod
  daily: UsagePeriod | null
  weekly: UsagePeriod | null
}

function shiftUtcDate(date: string, days: number): string | null {
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10)
}

function formatUtcDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function subtractTotals(later: UsageTotals, earlier: UsageTotals): UsageTotals {
  return Object.fromEntries(
    TRACKED_EVENT_NAMES.map((name) => [
      name,
      Math.max(0, (later[name] ?? 0) - (earlier[name] ?? 0)),
    ]),
  ) as UsageTotals
}

/** Derive exact completed UTC periods; missing boundary snapshots stay unavailable. */
export function buildUsagePeriods(
  lifetimeTotals: UsageTotals,
  snapshots: UsageSnapshot[],
): UsagePeriods {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const latest = ordered.at(-1)
  const byDate = new Map(ordered.map((snapshot) => [snapshot.date, snapshot]))

  let daily: UsagePeriod | null = null
  let weekly: UsagePeriod | null = null

  if (latest) {
    const previousDate = shiftUtcDate(latest.date, -1)
    const previous = previousDate ? byDate.get(previousDate) : null
    if (previous && previousDate) {
      daily = {
        label: `${formatUtcDate(previousDate)} UTC`,
        totals: subtractTotals(latest.totals, previous.totals),
      }
    }

    const weekStartDate = shiftUtcDate(latest.date, -7)
    const weekEndDate = shiftUtcDate(latest.date, -1)
    const weekStart = weekStartDate ? byDate.get(weekStartDate) : null
    if (weekStart && weekStartDate && weekEndDate) {
      weekly = {
        label: `${formatUtcDate(weekStartDate)}–${formatUtcDate(weekEndDate)} UTC`,
        totals: subtractTotals(latest.totals, weekStart.totals),
      }
    }
  }

  return {
    lifetime: { label: 'Lifetime totals', totals: lifetimeTotals },
    daily,
    weekly,
  }
}
