# The installable PWA has no visible in-app installation control

Status: OPEN · Priority: MEDIUM · Type: discoverability · Cost: none

> Successor to `no-pwa-manifest-or-offline-support.md`: installation and offline
> startup work; this ticket is only about how a user discovers installation.

## Symptom

The production app registers a service worker and links a valid manifest, but
the page contains no “Install app” button or installed/offline status. A user
testing the new features reported that they could not see the PWA feature. Plain
Vite development adds to the confusion because `src/main.tsx` deliberately
registers the service worker only when `import.meta.env.PROD` is true.

## Evidence

Browser QA on `http://127.0.0.1:5173/` found the manifest link but no service
worker registration. The production preview at `http://127.0.0.1:4173/` reported:

```json
{"controlled":true,"registration":true,"caches":["free-pdf-machine-2026-08-03-3"]}
```

Repository search finds no `beforeinstallprompt` listener or installation UI.

## Why it matters

The feature is real but invisible inside the product, leaving users dependent on
browser-specific menus/address-bar affordances. That makes “installable offline
PWA” read like an unshipped claim during local testing.

## Scope to decide

- Add an in-app Install button driven by `beforeinstallprompt` where supported,
  with browser-specific fallback instructions where it is not.
- Decide whether to show offline-ready/installed status and where it belongs
  without crowding the mobile header.
- Preserve production-only service-worker registration; development should not
  cache mutable Vite assets.
