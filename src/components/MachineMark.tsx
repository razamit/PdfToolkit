import { Cog } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Brand mark: two meshed cogs turning against each other.
 *
 * Sized in percentages so the mark scales with its container — the header uses
 * it at `size-9`, the empty state at `size-14`, from the same component.
 *
 * Both cogs are positioned absolutely rather than translated, because the
 * rotation keyframes own `transform`; a Tailwind translate utility on the same
 * element would be overwritten the moment the animation started.
 */
export function MachineMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground',
        className,
      )}
      aria-hidden
    >
      <Cog className="animate-cog-slow absolute left-[11%] top-[11%] size-[56%]" />
      <Cog className="animate-cog-reverse absolute bottom-[11%] right-[11%] size-[33%] text-primary-foreground/70" />
    </span>
  )
}
