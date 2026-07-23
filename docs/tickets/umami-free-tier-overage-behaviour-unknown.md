# Umami Cloud's behaviour when a free account exceeds 100k events/month is undocumented

Status: CLOSED (moot, 2026-07-23) · Priority: MEDIUM · Type: external-dependency-risk · Cost: none

> **Resolution:** no longer applicable. Umami was dropped entirely (decision row
> 8); the counters are now fed by a local Netlify Blob, so no Umami plan limit
> feeds anything on the site. There is no upstream free-tier cap to reason about.

> Prerequisite for trusting the public counters at scale. Distinct from
> `snapshot-usage-endpoint-is-publicly-triggerable.md`, which concerns abuse of our
> own endpoint rather than the limits of the upstream plan.

## Symptom

The public counters on the landing page are ultimately fed by Umami Cloud's Hobby
(free) tier, capped at 100,000 events/month. What happens on exceeding that cap is
not stated anywhere in Umami's documentation. The three candidate behaviours have
materially different consequences for us:

- Events are **dropped** → counters silently stop climbing mid-month, then jump
  on the 1st. Visitors would see a stalled machine.
- The account is **paused** → the nightly snapshot starts returning zeroes for
  affected days, permanently under-recording those days in our stored totals.
- Overage is **billed** (~$0.00002/event is reported by third parties) → an
  unexpected charge on an account with no payment method attached, or a silent
  upgrade prompt.

## Evidence

Umami's own Cloud FAQ defines how usage is *measured* but not what happens at the
limit:

> "usage is measured by counting hits to a website and any custom events or
> custom event data stored"
> — https://docs.umami.is/docs/cloud/faq

The FAQ contains no mention of dropping, pausing, or blocking past the cap. The
$0.00002/event overage figure appears only in third-party pricing summaries
(productanalytics.tools), documented in the context of paid plans with billing on
file — not the Hobby tier.

Our current event volume per active session is roughly 5–15 events (one
`file-added` per file, one per edit action, one `pdf-exported`). 100k events/month
therefore corresponds very approximately to 7,000–20,000 active sessions/month.

## Why it matters

This is not a correctness bug today — at current traffic the cap is far away, and
the durable snapshot design means historical totals can never regress regardless
of what Umami does (see `docs/DECISIONS.md` row 4). The exposure is specifically
about *growth*: the failure would arrive precisely when the site became popular,
and the first two candidate behaviours fail silently, with the counters looking
plausible while being wrong.

## Scope to decide

- Ask Umami support directly what the Hobby tier does at the cap, and record the
  answer here — cheapest option, resolves the unknown outright. **OR**
- Add a monthly-volume check to `netlify/functions/snapshot-usage.ts` that logs a
  warning as the running total approaches 100k, converting a silent failure into
  a visible one. **OR**
- Accept the risk until traffic is within ~50% of the cap, and revisit then.

**Trigger for revisiting:** monthly event volume exceeding 50,000, or any
observed flat spot in the counters that does not match a traffic dip.
