import { useEffect, useState } from 'react'
import type { UsageTotals } from '@/analytics/eventNames'

const ENDPOINT = '/api/usage'

export interface UsageCountersState {
  totals: UsageTotals | null
  isLoading: boolean
}

/**
 * Loading state and lifetime usage totals for the public counters.
 *
 * Every failure path resolves to null rather than an error state. In dev the
 * endpoint does not exist and Vite's SPA fallback answers with HTML, which fails
 * to parse — that is expected, not a fault. Callers can distinguish that settled
 * state from the initial request without exposing an error to the visitor.
 */
export function useUsageCounters(): UsageCountersState {
  const [totals, setTotals] = useState<UsageTotals | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetch(ENDPOINT, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<UsageTotals>) : null))
      .then((data) => {
        if (active && data && Object.keys(data).length > 0) setTotals(data)
      })
      .catch(() => {
        // Offline, blocked, or no backend — the counters simply stay hidden.
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return { totals, isLoading }
}
