/**
 * Compile-time regression test for the analytics privacy guarantee.
 *
 * This app's core promise is that files never leave the browser. That promise is
 * only as strong as the narrowest thing a future caller can pass to `track`, so
 * it is pinned here rather than left to reviewer vigilance.
 *
 * Each `@ts-expect-error` below asserts that the line *fails* to compile. If a
 * change ever widens the event types enough to let a filename or a block of user
 * text through, the directive becomes unused and `tsc` fails the build with
 * "Unused '@ts-expect-error' directive" — the test breaks loudly instead of the
 * guarantee breaking silently.
 *
 * Nothing imports this file, so it is type-checked but never bundled. Do not
 * delete it as dead code; it has no runtime job by design.
 */
import { createAnalyticsTracker } from './createAnalyticsTracker'

const tracker = createAnalyticsTracker()

// @ts-expect-error — filenames must never be sendable.
tracker.track({ name: 'file-added', kind: 'pdf', pageCount: 1, fileName: 'tax-return.pdf' })

// @ts-expect-error — user text must never be sendable.
tracker.track({ name: 'annotation-added', kind: 'text', text: 'my private note' })

// @ts-expect-error — image data must never be sendable.
tracker.track({ name: 'annotation-added', kind: 'image', dataUrl: 'data:image/png;base64,iVBOR' })

// @ts-expect-error — event names are a closed set; typos must not silently create new ones.
tracker.track({ name: 'made-up-event' })
