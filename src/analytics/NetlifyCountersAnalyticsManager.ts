import type { AnalyticsEventShape, AnalyticsTracker } from './AnalyticsTracker'

const ENDPOINT = '/api/track'

/**
 * Records events by posting their name to the site's own counter endpoint.
 *
 * Only `event.name` is sent — the counters need nothing else, and sending less
 * makes the privacy promise trivial rather than merely enforced. Fire-and-forget
 * with `keepalive` so a count still lands if the user navigates away in the same
 * moment (e.g. right after an export). Every failure is swallowed: analytics
 * must never disturb the app, and this endpoint sits on several ad-block lists.
 */
export class NetlifyCountersAnalyticsManager<TEvent extends AnalyticsEventShape>
  implements AnalyticsTracker<TEvent>
{
  track(event: TEvent): void {
    try {
      void fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: event.name }),
      }).catch(() => {})
    } catch {
      // Blocked, offline, or unsupported — the counter simply does not advance.
    }
  }
}
