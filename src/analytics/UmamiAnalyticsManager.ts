import type { AnalyticsEventShape, AnalyticsTracker } from './AnalyticsTracker'

/**
 * Sends events to Umami via the tracking script loaded in `index.html`.
 *
 * The script is deferred, so `window.umami` may not exist yet for events fired
 * very early. Those are dropped rather than queued — every event here follows a
 * deliberate user action, by which point the script has long since loaded.
 */
export class UmamiAnalyticsManager<TEvent extends AnalyticsEventShape>
  implements AnalyticsTracker<TEvent>
{
  track(event: TEvent): void {
    const { name, ...properties } = event
    try {
      window.umami?.track(name, properties)
    } catch {
      // Never let a broken or blocked tracker surface as an app error. Umami is
      // on several ad-block lists, so this path is expected, not exceptional.
    }
  }
}
