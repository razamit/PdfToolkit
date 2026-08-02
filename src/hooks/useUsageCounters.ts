import { useEffect, useState } from 'react'
import type { UsageHistory, UsageSnapshot, UsageTotals } from '@/analytics/eventNames'

const TOTALS_ENDPOINT = '/api/usage'
const HISTORY_ENDPOINT = '/api/usage/history'

export interface UsageCountersState {
  totals: UsageTotals | null
  snapshots: UsageSnapshot[]
  isLoading: boolean
}

async function readJson<T>(endpoint: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(endpoint, { signal })
  return response.ok ? (response.json() as Promise<T>) : null
}

/**
 * Loading state, lifetime totals, and dated history for the public counters.
 *
 * Every failure path resolves to null rather than an error state. In dev the
 * endpoint does not exist and Vite's SPA fallback answers with HTML, which fails
 * to parse — that is expected, not a fault. Callers can distinguish that settled
 * state from the initial request without exposing an error to the visitor.
 */
export function useUsageCounters(): UsageCountersState {
  const [totals, setTotals] = useState<UsageTotals | null>(null)
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    Promise.all([
      readJson<UsageTotals>(TOTALS_ENDPOINT, controller.signal).catch(() => null),
      readJson<UsageHistory>(HISTORY_ENDPOINT, controller.signal).catch(() => null),
    ])
      .then(([totalsData, historyData]) => {
        if (!active) return
        if (totalsData && Object.keys(totalsData).length > 0) setTotals(totalsData)
        if (historyData && Array.isArray(historyData.snapshots)) {
          setSnapshots(historyData.snapshots)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return { totals, snapshots, isLoading }
}
