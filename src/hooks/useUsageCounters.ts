import { useEffect, useState } from 'react'
import type { UsageTotals } from '@/analytics/eventNames'

const ENDPOINT = '/api/usage'

/**
 * Lifetime usage totals for the public counters, or null when unavailable.
 *
 * Every failure path resolves to null rather than an error state. In dev the
 * endpoint does not exist and Vite's SPA fallback answers with HTML, which fails
 * to parse — that is expected, not a fault. Callers render nothing when null.
 */
export function useUsageCounters(): UsageTotals | null {
  const [totals, setTotals] = useState<UsageTotals | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(ENDPOINT, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<UsageTotals>) : null))
      .then((data) => {
        if (data && Object.keys(data).length > 0) setTotals(data)
      })
      .catch(() => {
        // Offline, blocked, or no backend — the counters simply stay hidden.
      })

    return () => controller.abort()
  }, [])

  return totals
}
