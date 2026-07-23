import { SOURCE_COLORS } from '@/lib/sourceColors'

/**
 * Assigns a stable color to each uploaded source so pages can be tinted by
 * origin. Colors are handed out first-come by lowest free palette slot, so two
 * currently-loaded sources never collide until more than `SOURCE_COLORS.length`
 * files are loaded at once; a freed slot (source garbage-collected) is reused.
 *
 * Assignment is idempotent per `sourceId`, which keeps a source's color fixed
 * across page reordering and unrelated add/remove — the color is memory, not a
 * function of the current page order.
 */
export class SourceColorRegistry {
  private readonly indexBySource = new Map<string, number>()

  /** Give `sourceId` a palette slot (no-op if it already has one). */
  assign(sourceId: string): void {
    if (this.indexBySource.has(sourceId)) return
    const used = new Set(this.indexBySource.values())
    let index = 0
    while (index < SOURCE_COLORS.length && used.has(index)) index += 1
    // Past the palette size every slot is busy; wrap deterministically.
    this.indexBySource.set(sourceId, index % SOURCE_COLORS.length)
  }

  /** Free `sourceId`'s slot so it can be reused by a future source. */
  release(sourceId: string): void {
    this.indexBySource.delete(sourceId)
  }

  clear(): void {
    this.indexBySource.clear()
  }

  /** The color for `sourceId`, or undefined if it was never assigned. */
  colorFor(sourceId: string): string | undefined {
    const index = this.indexBySource.get(sourceId)
    return index === undefined ? undefined : SOURCE_COLORS[index]
  }
}
