# The nightly snapshot function can be triggered by anyone over HTTP

Status: OPEN · Priority: LOW · Type: security-hardening · Cost: none

> Distinct from `umami-free-tier-overage-behaviour-unknown.md`, which is about the
> upstream plan's limits rather than abuse of our own endpoint.

## Symptom

`netlify/functions/snapshot-usage.ts` is a scheduled function, but Netlify also
exposes every function at its HTTP path. It is therefore reachable by anyone at:

```
https://freepdfmachine.com/.netlify/functions/snapshot-usage
https://freepdfmachine.com/.netlify/functions/snapshot-usage?backfill=30
```

There is no authentication check. Each unauthenticated call costs 3 Umami API
requests by default, or up to 30 with `?backfill=30`.

## Evidence

The handler performs no credential check before doing work —
`netlify/functions/snapshot-usage.ts:24`:

```ts
export default async (req: Request): Promise<Response> => {
  const days = recentDayKeys(resolveDayCount(new URL(req.url)), new Date())
  const snapshotted: string[] = []

  try {
    for (const day of days) {
```

`netlify.toml` only maps `/api/usage` to the read-only counters function; the
snapshot function is not given a friendly path, but Netlify's built-in
`/.netlify/functions/*` route serves it regardless — that route is not something
`netlify.toml` redirects can withdraw.

Umami's documented rate limit is 50 API calls per 15 seconds per key
(https://docs.umami.is/docs/cloud/api-key). A caller looping `?backfill=30`
exceeds that in two requests.

## Why it matters

The blast radius is genuinely small, and worth stating plainly so this is not
over-prioritised:

- **No data can be corrupted.** Snapshots are keyed by UTC date and overwritten
  with the same values, so replaying the job is idempotent by construction. An
  attacker re-running it a thousand times leaves the stored totals identical.
- **No secret is exposed.** `UMAMI_API_KEY` stays server-side; the response
  contains only aggregate counts already published on the landing page.

The real exposure is availability: sustained hammering could keep our API key at
Umami's rate limit, so the legitimate nightly run receives `429` and that day's
snapshot fails. Because the job re-snapshots three days on every run, one failed
night self-heals — a permanent gap needs three consecutive failed nights.

## Scope to decide

- Require a shared secret (`SNAPSHOT_TOKEN` env var) on every invocation, and
  detect scheduled runs separately. Netlify's scheduled invocations were not
  verified to carry a distinguishing header, so this needs checking before it can
  be relied on. **OR**
- Require the token only for `?backfill=N`, leaving the bounded 3-call default
  path open. Cheap, and caps the worst case at 3 calls per request. **OR**
- Accept as-is. The idempotency and the 3-day healing window mean the realistic
  worst case is a one-day lag in a decorative counter.

**Trigger for revisiting:** any observed `429` from Umami in the function logs, or
a gap of more than one day in the stored snapshots.
