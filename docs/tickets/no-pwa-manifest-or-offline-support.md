# The app is not installable or usable offline — no PWA manifest or service worker

Status: CLOSED (2026-08-03) · Priority: LOW · Type: enhancement / distribution · Cost: none

> This is the "app story" chosen by `docs/DECISIONS.md` row 17 in place of a
> native-app wrapper, and a prerequisite for any future Google Play listing as a
> Trusted Web Activity. Not a defect — nothing is broken today; deferred behind
> the growth work of row 17.

## Symptom

The site has no web app manifest and no service worker, so it cannot be
installed to a home screen and does not work offline — even though every
operation already runs entirely in the browser, which makes offline support
essentially free. Observed 2026-07-26.

## Evidence

```
$ grep -iE "pwa|workbox|service-worker" package.json
  (none in package.json)

$ ls public/ | grep -iE "manifest|webmanifest"; find . -iname "*manifest*" -not -path "./node_modules/*"
  (no manifest in public/, none anywhere in the repo)

$ grep -rniE "manifest|serviceworker|registerSW|navigator.serviceWorker" index.html src/
  (no manifest <link>, no service-worker registration)
```

Assets a service worker must precache for offline to actually work (not just the
JS/CSS shell): the pdf.js worker, and the annotation font, which is fetched at
annotation time as a same-origin asset —

```
$ grep -n ANNOTATION_FONT_URL src/lib/annotationFont.ts
10:export const ANNOTATION_FONT_URL = '/fonts/LiberationSans-Regular.ttf'
28:    cachedFontBytes = fetch(ANNOTATION_FONT_URL).then((response) => {
```

Without that font cached, annotating a PDF breaks offline. The `/api/track` and
`/api/usage` calls are fire-and-forget decorative counters (DECISIONS rows 8–9)
and can fail offline harmlessly.

## Why it matters

Per DECISIONS row 17, a PWA is the deliberately chosen "app" story instead of a
native-app wrapper: installable + offline reinforces the "nothing is uploaded /
works without a network" privacy claim, keeps the single web codebase and all
its SEO (which a native wrapper would abandon), needs no app-store review, and
preserves a compliant future path to Google Play as a Trusted Web Activity. Low
priority because it is an enhancement, not a defect, and is gated behind reaching
meaningful traffic (~10k pv/mo).

## Scope to decide

- **Tooling:** `vite-plugin-pwa` (Workbox under the hood, minimal config) — OR a
  hand-rolled manifest + service worker (no dependency, more code to maintain).
- **Precache set:** must include the pdf.js worker and
  `/fonts/LiberationSans-Regular.ttf`, not just the app shell, or preview and
  annotation break offline.
- **Counters offline:** let the `/api/*` calls fail silently — they are
  decorative (rows 8–9), so no offline queue is needed.
- **Install affordance:** add an explicit "Install app" button, or rely on the
  browser's native install prompt.
- **Icons:** reuse the two-cog `MachineMark` (row 5) exported to PNG at 192 and
  512 px, including a maskable variant.

No code change made by this ticket — it is an observation on the record.

## Resolution

Closed by the 2026-08-03 progress entry “Shipped the seven requested PDF
workflows…” and decision row 30. The app now has a manifest, production-only
service-worker registration, manifest-driven application precaching, fixed
pdf.js decoder/font caching, cache retirement and verified server-off startup.
The implementation relies on the browser's native installation UI. The distinct
remaining discoverability gap is tracked in
`pwa-install-affordance-is-not-visible.md`.
