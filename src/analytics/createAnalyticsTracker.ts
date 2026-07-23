import type { AnalyticsTracker } from './AnalyticsTracker'
import type { ToolkitAnalyticsEvent } from './toolkitEvents'
import { NoopAnalyticsManager } from './NoopAnalyticsManager'
import { NetlifyCountersAnalyticsManager } from './NetlifyCountersAnalyticsManager'

/**
 * Picks the tracker for the current build.
 *
 * Development always gets the no-op so local work never pollutes production
 * counts. Production posts to the site's own `/api/track` endpoint, which itself
 * only accepts writes from the canonical host — so deploy previews cannot reach
 * the real totals even though they run this same code. Two independent guards,
 * because a polluted dataset is not something you can clean up after the fact.
 */
export function createAnalyticsTracker(): AnalyticsTracker<ToolkitAnalyticsEvent> {
  if (import.meta.env.DEV) return new NoopAnalyticsManager<ToolkitAnalyticsEvent>()
  return new NetlifyCountersAnalyticsManager<ToolkitAnalyticsEvent>()
}
