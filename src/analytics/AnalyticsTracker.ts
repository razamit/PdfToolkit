/**
 * Provider-agnostic analytics protocol.
 *
 * Nothing outside `src/analytics/` may import a vendor SDK, so swapping the
 * analytics backend stays a one-file change.
 *
 * Property values are constrained to primitives deliberately. This app promises
 * that files never leave the browser, and the narrowest way to keep that promise
 * is to make it unrepresentable: a filename, annotation string, or image data URL
 * cannot be passed to `track` without a compile error. The guarantee is enforced
 * by the type checker, not by a comment asking future callers to be careful.
 */
export type AnalyticsPropertyValue = string | number | boolean

/** An event is a name plus flat, primitive-only properties. */
export interface AnalyticsEventShape {
  name: string
  [property: string]: AnalyticsPropertyValue
}

export interface AnalyticsTracker<TEvent extends AnalyticsEventShape = AnalyticsEventShape> {
  /**
   * Report a single event. Implementations must never throw and never block —
   * analytics failing is always less important than the app continuing to work.
   */
  track(event: TEvent): void
}
