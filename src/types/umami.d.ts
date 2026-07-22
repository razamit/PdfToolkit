export {}

declare global {
  interface Window {
    /** Injected by the Umami tracking script; absent when it is blocked or still loading. */
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void
    }
  }
}
