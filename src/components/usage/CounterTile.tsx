import { useCountUp } from '@/hooks/useCountUp'
import type { CounterSpec } from './counterSpecs'

const formatter = new Intl.NumberFormat('en-US')

interface CounterTileProps extends Pick<CounterSpec, 'label' | 'Icon'> {
  total: number
  /** Starts the count-up; driven by one shared observer on the panel. */
  active: boolean
}

/** One machine-readout tile: icon, animated total, caption. */
export function CounterTile({ label, Icon, total, active }: CounterTileProps) {
  const value = useCountUp(total, active)

  return (
    <div className="flex flex-col items-center text-center">
      <Icon className="order-1 mb-2 size-4 text-muted-foreground/60" aria-hidden />
      {/* tabular-nums keeps the tile from twitching as digits change width. */}
      <dd className="order-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {formatter.format(value)}
      </dd>
      <dt className="order-3 mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}
