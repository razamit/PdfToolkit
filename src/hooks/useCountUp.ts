import { useEffect, useState } from 'react'

const DURATION_MS = 1200

/** Ease-out cubic — fast start, gentle settle, so the final digits are readable. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Animates 0 → `target` once `active` turns true.
 *
 * Returns the target immediately when the visitor has asked for reduced motion,
 * so the number is still correct without the movement.
 */
export function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    if (prefersReducedMotion() || target === 0) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      setValue(Math.round(target * easeOut(progress)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frame)
  }, [target, active])

  return value
}
