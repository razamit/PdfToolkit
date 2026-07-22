import type { AnalyticsTracker } from './AnalyticsTracker'
import type { ToolkitAnalyticsEvent } from './toolkitEvents'
import { NoopAnalyticsManager } from './NoopAnalyticsManager'
import { UmamiAnalyticsManager } from './UmamiAnalyticsManager'

/**
 * Picks the tracker for the current build.
 *
 * Development always gets the no-op so local work never pollutes production
 * counts. Deploy previews are handled separately by the `data-domains` attribute
 * on the tracking script, which stops Umami reporting from any host other than
 * the live domain. Two independent guards, because a polluted dataset is not
 * something you can clean up after the fact.
 */
export function createAnalyticsTracker(): AnalyticsTracker<ToolkitAnalyticsEvent> {
  if (import.meta.env.DEV) return new NoopAnalyticsManager<ToolkitAnalyticsEvent>()
  return new UmamiAnalyticsManager<ToolkitAnalyticsEvent>()
}
