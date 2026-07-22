# Implementation Progress

Newest entry first. One entry per completed unit of work — dated headline,
scope note, status marker (✅ DONE / 🟡 PARTIAL / ⛔ NOT STARTED), proof,
files touched, cross-refs to decisions and tickets. Never rewrite old entries.

---

**2026-07-22 — Netlify subdomain redirected to the canonical domain (config only;
requires a deploy to take effect). 🟡 PARTIAL.**
The trigger was noticing `pdfedittoolkit.netlify.app` still served the app rather
than redirecting, so the site answered on two hostnames with identical content
against a `<link rel="canonical">` naming only one. The first attempt — setting
`freepdfmachine.com` as the primary domain in the Netlify UI — was the wrong fix
and is worth recording as a dead end: Netlify auto-redirects domain *aliases* but
never the `.netlify.app` subdomain, which its own Domains UI shows by labelling
`www.freepdfmachine.com` "Redirects automatically to primary domain" and the
subdomain not at all. Replaced with an explicit host-level 301 in `netlify.toml`,
declared above the `/*` SPA catch-all (which matches every hostname and would
otherwise swallow it) and carrying `force = true` (without which the redirect
loses to `index.html` and silently no-ops).
**Proof:** before-state measured live, primary domain already set —
`pdfedittoolkit.netlify.app` → `status=200`, no `Location`; `www.freepdfmachine.com`
→ `status=301` → `https://freepdfmachine.com/`. Domain registration and DNS
verified independently: `freepdfmachine.com` created 2026-07-22T13:17:09Z at
NameCheap, nameservers `dns{1..4}.p01.nsone.net` (Netlify DNS), apex 200 with a
valid cert, `http` → `https` 301. Also resolved a standing unknown from the
counters entry below: `/api/usage` returns `application/json`, **not** index.html,
so the redirect ordering there is correct — though it currently returns `{}`,
consistent with `UMAMI_WEBSITE_ID`/`UMAMI_API_KEY` still being unset, and
`usage-counters.ts` cannot distinguish "no snapshots yet" from "backend threw".
**What remains:** the redirect is unverified — a `netlify.toml` change is inert
until deployed. Re-measure `pdfedittoolkit.netlify.app` for a 301 after the next
deploy, including a deep path to confirm `:splat` preserves it. Not committed;
no commit was requested.
**Files:** `netlify.toml`, `docs/DECISIONS.md`.
**Cross-refs:** decision row 7, which records why the primary-domain setting was
insufficient and why the rule's position and `force` flag must not be tidied away.

---

**2026-07-22 — Counters made fresher: snapshot job hourly, display threshold
lowered (config change only). ✅ DONE.**
Follow-up to the counters work below. Investigating "when does it fetch from
Umami?" made the real constraint obvious: the page reads stored snapshots and
never queries Umami, so on a `@daily` schedule the panel would have stayed empty
until midnight UTC on launch day regardless of traffic, and thereafter could omit
a full day of activity. Schedule moved to `@hourly` (worst-case lag now ~1h plus
15min CDN cache, down from ~24h). `MINIMUM_TOTAL_TO_SHOW` lowered 25 → 5, though
at ~660 visitors/day that threshold is cleared within hours either way — it was
never the binding constraint.
**Proof:** `npm run build` green; `npm run lint` unchanged at 4 warnings, all
pre-existing in `src/components/ui/button.tsx` and
`src/components/ThumbnailGrid.tsx`. Rate-limit headroom checked rather than
assumed: 3 Umami calls per run × 24 runs = 72/day against a documented
50-per-15-seconds limit, and ~720 invocations/month against Netlify's 125k free
tier.
**Files:** `netlify/functions/snapshot-usage.ts`,
`src/components/usage/UsageCounters.tsx`, `README.md`.
**Cross-refs:** decision row 6, which supersedes those two parameters of row 4.

---

**2026-07-22 — Usage analytics via Umami, plus public "machine so far" counters
(code + docs; adds a Netlify Functions backend and two required env vars; no
external spend). 🟡 PARTIAL.**
The trigger was wanting to know how many people actually export a PDF. Netlify
Analytics cannot answer that at all — it is server-log-only and export never
touches the network — so Umami Cloud was adopted instead (decision row 2, which
also records why GA4, Firebase and Plausible lost). Added `src/analytics/`: a
provider-agnostic `AnalyticsTracker` protocol with Umami and no-op
implementations, and a typed event union covering all eight user actions
(`file-added`, `pages-removed`, `pages-rotated`, `pages-resized`,
`pages-reordered`, `signature-added`, `annotation-added`, `pdf-exported`), wired
as one-line calls into the existing coordinator handlers. Event properties are
constrained to primitives so filenames and annotation text cannot be sent
(decision row 3). Public counters are fed by `netlify/functions/snapshot-usage.ts`
(nightly, writes per-UTC-day snapshots into Netlify Blobs) and read back through
`netlify/functions/usage-counters.ts` at `/api/usage`; snapshots rather than live
Umami queries are the source of truth because the free tier retains only six
months and an all-time query would eventually make the counters fall (decision
row 4).
**Proof:** `npx tsc -b` exits 0 across the app and the new `tsconfig.netlify.json`
project; `npm run build` green (385 modules, 203ms); `npm run lint` reports 4
warnings, all pre-existing in `src/components/ui/button.tsx` and
`src/components/ThumbnailGrid.tsx`, none in new files. The counters UI was
verified in a real browser against a stubbed `/api/usage` at 1440×1000 and
390×844 — this surfaced a genuine bug: `useInView` created its
IntersectionObserver in a `[]`-dep effect, but `UsageCounters` returns `null`
while the fetch is in flight, so the ref was null when the effect ran and never
re-ran once the panel mounted; every counter rendered a permanent 0. Rewritten to
use a callback ref keyed on node state, re-verified, numbers now animate
correctly. `src/analytics/privacyGuarantee.typetest.ts` pins the privacy
guarantee with four `@ts-expect-error` assertions.
**What remains (why PARTIAL):** the backend has never executed against the real
Umami API. `UMAMI_WEBSITE_ID` and `UMAMI_API_KEY` are not yet set in Netlify, so
the request/response shape in `netlify/lib/umamiClient.ts` is written from
Umami's documentation rather than from an observed call, and the nightly schedule
has never fired. First deploy must confirm: (a) `/api/usage` returns JSON rather
than the SPA fallback, (b) a manual
`?backfill=30` run succeeds, (c) the returned rows match the `{x, y}` shape
assumed. Until then the counters correctly render nothing.
**Files:** new — `src/analytics/{AnalyticsTracker,UmamiAnalyticsManager,NoopAnalyticsManager,createAnalyticsTracker,toolkitEvents,eventNames,privacyGuarantee.typetest}.ts`,
`src/types/umami.d.ts`, `src/hooks/{useUsageCounters,useInView,useCountUp}.ts`,
`src/components/usage/{UsageCounters.tsx,CounterTile.tsx,counterSpecs.ts}`,
`netlify/functions/{snapshot-usage,usage-counters}.ts`,
`netlify/lib/{umamiClient,usageStore,days}.ts`, `tsconfig.netlify.json`;
modified — `src/coordinator/PdfToolkitCoordinator.tsx`, `index.html`,
`netlify.toml`, `tsconfig.json`, `package.json`, `package-lock.json`
(`@netlify/blobs`, `@netlify/functions`), `README.md`.
**Cross-refs:** decisions rows 2, 3, 4. Opened
`docs/tickets/umami-free-tier-overage-behaviour-unknown.md` and
`docs/tickets/snapshot-usage-endpoint-is-publicly-triggerable.md`.

---

**2026-07-22 — Rebranded to Free PDF Machine for freepdfmachine.com (code + docs,
no behaviour change). ✅ DONE.**
The domain was purchased, so "PDF Toolkit" became "Free PDF Machine" throughout:
header, footer, page title, Open Graph tags, canonical URL, favicon, README, and
the export filename (`freepdfmachine-export.pdf`). Added `MachineMark`, a brand
mark of two meshed cogs counter-rotating at 14s and 10s per revolution, sized in
percentages so one component serves both the header at `size-9` and the empty
state at `size-14`; both cogs are positioned absolutely rather than translated
because the rotation keyframes own `transform`. Motion is disabled outright under
`prefers-reduced-motion`. The existing indigo accent and zinc neutral palette are
unchanged — this is a name and mark change, not a redesign. The machine metaphor
carries into the counters panel ("The machine so far", "Files fed in", "Pages
spun"). The README's feature list was also stale and now covers signatures,
annotations, and page resizing.
**Proof:** `npm run build` green; verified in a real browser at 1440×1000 and
390×844 — brand mark, header, empty state, counters panel and footer all render
correctly, mobile collapses to a two-column counter grid with no horizontal
overflow, and the cog is visibly at a different angle between two captures,
confirming the animation runs.
**Files:** new — `src/components/MachineMark.tsx`; modified —
`src/components/{AppHeader,EmptyState,PdfToolkitView}.tsx`,
`src/coordinator/PdfToolkitCoordinator.tsx`, `src/index.css`, `index.html`,
`public/favicon.svg`, `README.md`.
**Cross-refs:** decision row 5.

---

**2026-07-22 — Devlog system adopted (docs only, no code change). ✅ DONE.**
Scaffolded `docs/PROGRESS.md`, `docs/DECISIONS.md` and `docs/tickets/`; wired
pointers into `CLAUDE.md`. From here on, every session that changes files ends
with a session-wrap: evidence summary verified against the diff, then a
progress entry, decision rows, and a ticket sweep, then the commit.
