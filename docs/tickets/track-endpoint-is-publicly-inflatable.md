# The public /api/track endpoint can be inflated by anyone with a loop

Status: OPEN · Priority: LOW · Type: abuse-resistance · Cost: none

> This is the exposure decision row 4 warned about and row 8 accepted knowingly:
> a public, unauthenticated write endpoint feeding a decorative counter. Replaces
> `snapshot-usage-endpoint-is-publicly-triggerable.md` (now closed), which was
> about the old read-from-Umami job rather than a write path.

## Symptom

`netlify/functions/track-usage.ts` (`/api/track`) increments a stored counter on
any POST that carries a known event name and the canonical `Host`. There is no
authentication, no per-IP rate limit, and no proof the event actually happened —
so anyone can inflate the "machine so far" totals:

```
for i in $(seq 1 100000); do
  curl -s -X POST https://freepdfmachine.com/api/track \
    -H 'content-type: application/json' -d '{"name":"pdf-exported"}' >/dev/null
done
```

## Evidence

The handler validates only the event name and the host, then writes
(`netlify/functions/track-usage.ts`):

```ts
if (typeof name === 'string' && TRACKED.has(name)) {
  try {
    await incrementEvent(name as TrackedEventName)
```

The `Host` guard (`CANONICAL_HOSTS`) keeps deploy previews and the `.netlify.app`
subdomain out of production data, but `Host` is a client-supplied header — a
hand-rolled request can set it to `freepdfmachine.com` and be counted. It stops
accidental cross-environment writes, not deliberate abuse.

## Why it matters

Small, and worth stating plainly so it is not over-prioritised:

- **Nothing is corrupted or exposed.** The counter is decorative; there are no
  per-visitor records, no secrets, and no downstream system that trusts these
  numbers. The worst outcome is a visibly wrong vanity figure.
- **Cost is bounded by Netlify's free tier**, not by this endpoint — 125k
  function invocations/month, after which functions stop rather than bill on the
  free plan. A sustained attack degrades the counter, not the wallet.

The realistic exposure is a defaced counter (e.g. one event at an implausible
number), and, at extreme volume, burning the monthly function quota so legitimate
increments stop until the next month.

## Scope to decide

- Accept as-is — the counter is decorative and the blast radius is a wrong number.
  **OR**
- Add a lightweight per-IP rate limit (e.g. Netlify's edge rate limiting, or a
  short-TTL blob per IP) so no single source can add more than N/min. **OR**
- Sanity-cap displayed growth: reject increments that would move a counter by more
  than a plausible per-request delta, or clamp the displayed value.

**Trigger for revisiting:** a counter showing an implausible value, a spike in
`/api/track` invocations in the Netlify function logs, or the monthly invocation
count approaching the free-tier ceiling.

No code change made by this ticket — it is an observation on the record.
