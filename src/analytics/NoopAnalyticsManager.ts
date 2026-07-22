import type { AnalyticsEventShape, AnalyticsTracker } from './AnalyticsTracker'

/**
 * Discards every event. Used in development and whenever no analytics backend
 * is configured, so call sites never need to null-check the tracker.
 */
export class NoopAnalyticsManager<TEvent extends AnalyticsEventShape>
  implements AnalyticsTracker<TEvent>
{
  track(): void {
    // Intentionally empty.
  }
}
