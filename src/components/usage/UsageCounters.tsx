import { Cog } from 'lucide-react'
import { useInView } from '@/hooks/useInView'
import { useUsageCounters } from '@/hooks/useUsageCounters'
import { COUNTER_SPECS } from './counterSpecs'
import { CounterTile } from './CounterTile'

/**
 * Below this combined total the panel stays hidden, so a brand-new deployment
 * does not advertise single digits. Counts every event, not each counter — a
 * single full session produces roughly 6–10 on its own.
 */
const MINIMUM_TOTAL_TO_SHOW = 5

/**
 * Public readout of what the machine has done so far.
 *
 * Shows a same-size skeleton while the backend answers, then real numbers. The
 * reserved responsive height prevents the content below from shifting. Before
 * the first tracked event, in development, and whenever the endpoint is
 * unreachable, the space remains reserved without showing eight misleading zeros.
 */
export function UsageCounters() {
  const { totals, isLoading } = useUsageCounters()
  const { ref, inView } = useInView<HTMLElement>()

  if (isLoading) {
    return (
      <section
        className="mt-10 min-h-[31.125rem] w-full max-w-2xl rounded-2xl border bg-card/60 px-5 py-6 sm:min-h-[18.75rem]"
        aria-busy="true"
        aria-live="polite"
      >
        <h3 className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Cog className="size-3.5 animate-cog-slow text-primary" aria-hidden />
          Loading stats…
        </h3>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4" aria-hidden>
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
        className="mt-10 min-h-[31.125rem] w-full max-w-2xl sm:min-h-[18.75rem]"
        aria-hidden
      />
    )
  }

  const grandTotal = Object.values(totals).reduce((sum, count) => sum + count, 0)
  if (grandTotal < MINIMUM_TOTAL_TO_SHOW) {
    return (
      <div
        className="mt-10 min-h-[31.125rem] w-full max-w-2xl sm:min-h-[18.75rem]"
        aria-hidden
      />
    )
  }

  return (
    <section
      ref={ref}
      className="mt-10 min-h-[31.125rem] w-full max-w-2xl rounded-2xl border bg-card/60 px-5 py-6 sm:min-h-[18.75rem]"
    >
      <h3 className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Cog className="size-3.5 animate-cog-slow text-primary" aria-hidden />
        The machine so far
      </h3>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {COUNTER_SPECS.map((spec) => (
          <CounterTile
            key={spec.name}
            label={spec.label}
            Icon={spec.Icon}
            total={totals[spec.name] ?? 0}
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
