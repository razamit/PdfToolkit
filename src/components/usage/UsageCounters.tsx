import { useMemo, useState } from 'react'
import { Cog } from 'lucide-react'
import { buildUsagePeriods, type UsagePeriodName } from '@/analytics/usagePeriods'
import { useInView } from '@/hooks/useInView'
import { useUsageCounters } from '@/hooks/useUsageCounters'
import { cn } from '@/lib/utils'
import { COUNTER_SPECS } from './counterSpecs'
import { CounterTile } from './CounterTile'

/**
 * Below this combined total the panel stays hidden, so a brand-new deployment
 * does not advertise single digits. Counts every event, not each counter — a
 * single full session produces roughly 6–10 on its own.
 */
const MINIMUM_TOTAL_TO_SHOW = 5

const PERIOD_OPTIONS: ReadonlyArray<{ name: UsagePeriodName; label: string }> = [
  { name: 'lifetime', label: 'All time' },
  { name: 'daily', label: 'Daily' },
  { name: 'weekly', label: 'Weekly' },
]

/**
 * Public readout of what the machine has done so far.
 *
 * Shows a same-size skeleton while the backend answers, then real numbers. The
 * reserved responsive height prevents the content below from shifting. Before
 * the first tracked event, in development, and whenever the endpoint is
 * unreachable, the space remains reserved without showing eight misleading zeros.
 */
export function UsageCounters() {
  const { totals, snapshots, isLoading } = useUsageCounters()
  const { ref, inView } = useInView<HTMLElement>()
  const [periodName, setPeriodName] = useState<UsagePeriodName>('lifetime')
  const periods = useMemo(
    () => (totals ? buildUsagePeriods(totals, snapshots) : null),
    [totals, snapshots],
  )

  if (isLoading) {
    return (
      <section
        className="mt-10 min-h-[35.25rem] w-full max-w-2xl rounded-2xl border bg-card/60 px-5 py-6 sm:min-h-[23rem]"
        aria-busy="true"
        aria-live="polite"
      >
        <h3 className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Cog className="size-3.5 animate-cog-slow text-primary" aria-hidden />
          Loading stats…
        </h3>

        <div className="mt-4 flex justify-center" aria-hidden>
          <div className="h-8 w-52 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mx-auto mt-2 h-4 w-24 animate-pulse rounded bg-muted" aria-hidden />

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4" aria-hidden>
          {COUNTER_SPECS.map(({ name, label, Icon }) => (
            <div key={name} className="flex flex-col items-center text-center">
              <Icon className="order-1 mb-2 size-4 text-muted-foreground/30" />
              <dd className="order-2 h-7 w-12 animate-pulse rounded bg-muted sm:h-8" />
              <dt className="order-3 mt-0.5 text-xs text-muted-foreground/60">{label}</dt>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
          Counted anonymously. No files, names, or content — only how many times each lever was
          pulled.
        </p>
      </section>
    )
  }

  // Keep the same footprint when counters are unavailable or a deployment is
  // too new to show them. If data arrives, nothing below the panel has to move.
  if (!totals) {
    return (
      <div
        className="mt-10 min-h-[35.25rem] w-full max-w-2xl sm:min-h-[23rem]"
        aria-hidden
      />
    )
  }

  const grandTotal = Object.values(totals).reduce((sum, count) => sum + count, 0)
  if (grandTotal < MINIMUM_TOTAL_TO_SHOW) {
    return (
      <div
        className="mt-10 min-h-[35.25rem] w-full max-w-2xl sm:min-h-[23rem]"
        aria-hidden
      />
    )
  }

  if (!periods) return null

  const activePeriod = periods[periodName] ?? periods.lifetime

  return (
    <section
      ref={ref}
      className="mt-10 min-h-[35.25rem] w-full max-w-2xl rounded-2xl border bg-card/60 px-5 py-6 sm:min-h-[23rem]"
    >
      <h3 className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Cog className="size-3.5 animate-cog-slow text-primary" aria-hidden />
        The machine so far
      </h3>

      <div
        className="mt-4 inline-flex rounded-lg bg-muted p-1"
        role="group"
        aria-label="Stats period"
      >
        {PERIOD_OPTIONS.map((option) => {
          const available = periods[option.name] !== null
          return (
            <button
              key={option.name}
              type="button"
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
                periodName === option.name
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              disabled={!available}
              aria-pressed={periodName === option.name}
              title={available ? undefined : 'Available after enough daily UTC snapshots exist'}
              onClick={() => setPeriodName(option.name)}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <p className="mt-2 h-4 text-[11px] text-muted-foreground" aria-live="polite">
        {activePeriod.label}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {COUNTER_SPECS.map((spec) => (
          <CounterTile
            key={spec.name}
            label={spec.label}
            Icon={spec.Icon}
            total={activePeriod.totals[spec.name] ?? 0}
            active={inView}
          />
        ))}
      </dl>

      <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
        Counted anonymously. No files, names, or content — only how many times each lever was pulled.
      </p>
    </section>
  )
}
