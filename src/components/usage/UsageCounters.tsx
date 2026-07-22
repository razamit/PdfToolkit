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
 * Renders nothing until the backend answers with real numbers — before the first
 * nightly snapshot, in development, and whenever the endpoint is unreachable.
 * A counters panel showing eight zeros is worse than no panel at all.
 */
export function UsageCounters() {
  const totals = useUsageCounters()
  const { ref, inView } = useInView<HTMLElement>()

  if (!totals) return null

  const grandTotal = Object.values(totals).reduce((sum, count) => sum + count, 0)
  if (grandTotal < MINIMUM_TOTAL_TO_SHOW) return null

  return (
    <section ref={ref} className="mt-10 w-full max-w-2xl rounded-2xl border bg-card/60 px-5 py-6">
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
