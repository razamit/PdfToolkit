const MS_PER_DAY = 86_400_000

/** UTC day key, e.g. `2026-07-21`. */
export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Unix-ms bounds covering a whole UTC day. */
export function dayBounds(day: string): { startAt: number; endAt: number } {
  const startAt = Date.parse(`${day}T00:00:00.000Z`)
  if (Number.isNaN(startAt)) throw new Error(`Not a valid day key: ${day}`)
  return { startAt, endAt: startAt + MS_PER_DAY - 1 }
}

/**
 * The `count` most recent UTC days, today first.
 *
 * Today is included even though it is still in progress — its snapshot is
 * overwritten by the following night's run, so a partial figure is always
 * replaced by the complete one rather than being lost.
 */
export function recentDayKeys(count: number, now: Date): string[] {
  const days: string[] = []
  for (let offset = 0; offset < count; offset += 1) {
    days.push(toDayKey(new Date(now.getTime() - offset * MS_PER_DAY)))
  }
  return days
}
