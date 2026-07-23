# Implementation Progress

Newest entry first. One entry per completed unit of work — dated headline,
scope note, status marker (✅ DONE / 🟡 PARTIAL / ⛔ NOT STARTED), proof,
files touched, cross-refs to decisions and tickets. Never rewrite old entries.

---

**2026-07-23 — SEO/AEO discovery layer built from an audit that scored the live
site 11/40 (static files + `netlify.toml` headers + JSON-LD; no application
code touched; nothing deployed yet). 🟡 PARTIAL.** A full SEO and AEO audit was
run against production first, by live HTTP probe rather than source reading. It
found two root causes behind almost every failure. **One:** the served body is
`<div id="root"></div>` and nothing else, so every crawler and every non-rendering
AI agent received 1,508 bytes whose entire textual content was the `<title>` and
the meta description. All agent user agents were confirmed to get byte-identical
content to a browser (md5 `304177ad850ff56829ffe9b4bfb59316` for GPTBot,
ChatGPT-User, ClaudeBot, PerplexityBot, Googlebot and Mozilla alike, so no bot
challenge and no cloaking) — the bytes are simply empty. **Two:** none of the
discovery layer existed, and the SPA catch-all answered *every* path with the app
shell at status 200, so `/robots.txt`, `/sitemap.xml`, `/llms.txt` and
`/.well-known/agent-card.json` all returned `200 text/html 1508` and every
mistyped URL was an indexable soft-404. Nothing declared in machine-readable form
that the product is free; the word "free" appeared only inside the brand name.
**Shipped in this session** (the "quick wins" tier of the audit's action plan, ~23
of the 29 missing points): `public/robots.txt` with a `Sitemap:` line, a
`Content-Signal: search=yes, ai-input=yes, ai-train=yes` block and explicit
`Allow: /` stanzas for all 15 named AI crawlers; `public/sitemap.xml`;
`public/llms.txt` (blockquote value prop, key pages, an explicit **For agents**
section including when *not* to recommend the tool, `Last verified` footer);
`public/llms-full.txt` (11-section single-fetch briefing: what it is, every
feature, the lossless-export mechanism, the privacy posture, a 7-question FAQ, a
fair comparison against upload-based editors with the trade-offs stated, and
contact); `public/index.md` as the markdown twin; `public/.well-known/agent-card.json`
(explicitly flagged `"callable": false` so it cannot be mistaken for an A2A
endpoint that does not exist); `public/og-image.png`, a purpose-built 1200×630
card rendered headless via `agent-browser` in the app's own palette; a JSON-LD
`@graph` in `index.html` with `WebApplication` (+ `Offer` `price: "0"` USD,
`isAccessibleForFree`, 9-item `featureList`), `WebSite`, `WebPage` (+`speakable`)
and a 7-question `FAQPage`, with `author`/`creator` → `https://rzailabs.com/#amitraz`
and `publisher`/`provider` → `https://rzailabs.com/#organization`; rewritten
`<title>` and description leading with the head term; `robots`, `author`,
`og:image`, `og:site_name`, `og:locale` and the full Twitter `summary_large_image`
set; and `[[headers]]` in `netlify.toml` for the `Link` header
(`rel="sitemap"` + `rel="describedby"`), `X-Frame-Options` / `X-Content-Type-Options`
/ `Referrer-Policy`, `immutable` caching on the content-hashed `/assets/*`,
30-day caching on the un-hashed `/fonts/*`, explicit `Content-Type`s on the
plain-text surfaces, and `Access-Control-Allow-Origin: *` on `/.well-known/*`.
`CLAUDE.md` gained a "Discovery surfaces must move together" section listing all
seven surfaces that must change in the same commit as any user-facing claim.
**Why PARTIAL, stated plainly:** (a) the `netlify.toml` headers, the served
`Content-Type`s and the `Link` header are **not verified live** — they take effect
only on the next deploy and must be re-probed then, exactly as decision row 7
required of its redirect; nothing in this entry has been deployed. (b) Google
Search Console verification is not done, pending a token from the user; it is one
line. (c) The `FAQPage` markup deliberately ships ahead of a visible on-page FAQ.
(d) The audit's structural tier was scoped out by agreement and is on the record
as four tickets, not as TODOs. **Proof:** `npm run build` green (395 modules);
`npx tsc -b` clean; `npm run lint` unchanged at 4 pre-existing warnings
(`button.tsx`, `ThumbnailGrid.tsx` ×3); JSON-LD validated by script — 1 block, 4
nodes, parses, **0 orphan `@id` references**, both parent entity `@id`s present
verbatim, 7 FAQ questions with answers of 334–521 chars; `sitemap.xml` parses with
the correct `http://www.sitemaps.org/schemas/sitemap/0.9` namespace (an earlier
draft had `sitemap.org` singular and was caught and fixed); `agent-card.json`
parses, 5 skills; all seven new files confirmed in `dist/` after build, including
`dist/.well-known/agent-card.json`, so Vite does copy dot-directories from
`publicDir`. Product claims were checked against the code rather than assumed:
a draft line claiming the tool "does not remove or apply password protection" was
corrected after finding `src/managers/PdfSourceManager.ts:98-116` opens
owner-encrypted PDFs with an empty user password and rejects only view-password
files; `grep` confirmed there is no service worker, no `localStorage`,
`sessionStorage` or `IndexedDB`, no OCR and no form-filling, which is what makes
the "nothing is kept between sessions" and offline answers accurate. **Score:**
11/40 (27.5%) measured before; projected ≈33/41 (80%) once deployed, ≈34/41 once
the GSC tag lands, and ≈41/41 after the four tickets. **Files:** added
`public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`,
`public/llms-full.txt`, `public/index.md`, `public/.well-known/agent-card.json`,
`public/og-image.png`; edited `index.html`, `netlify.toml`, `CLAUDE.md`.
**Decisions:** row 13, and open question 1 (whether the SPA catch-all is needed at
all). **Tickets opened:** `served-html-has-no-crawlable-content.md` (HIGH, the
root cause and the largest remaining item),
`faq-markup-has-no-visible-counterpart.md`, `every-url-returns-200-soft-404.md`,
`pdfjs-bundled-into-entry-chunk.md`.

[**Update, 2026-07-23 — deployed and re-probed live; this entry's status moves
from 🟡 PARTIAL to ✅ DONE for its stated scope.** The two items that held it at
PARTIAL are both resolved. (a) The `netlify.toml` headers are confirmed live on
`https://freepdfmachine.com/`: `link: </sitemap.xml>; rel="sitemap",
</llms.txt>; rel="describedby"`, `x-frame-options: SAMEORIGIN`,
`x-content-type-options: nosniff`, `referrer-policy:
strict-origin-when-cross-origin`, and `/assets/index-BVDIQYJA.js` now returns
`cache-control: public,max-age=31536000,immutable` (was
`max-age=0,must-revalidate`), `/fonts/*` returns `max-age=2592000`, and
`/.well-known/agent-card.json` returns `access-control-allow-origin: *`. (b)
Google Search Console verification is done by DNS TXT on the apex, confirmed
resolving on both Google and Cloudflare public resolvers:
`"google-site-verification=L0IoC4r_aIPVv2meOMQmJoK9mRZUyfTT_MSUzykaT54"`. All six
discovery files serve with correct types and no longer return the app shell:
`/robots.txt 200 text/plain 2256`, `/sitemap.xml 200 application/xml 269`,
`/llms.txt 200 text/plain 3809`, `/llms-full.txt 200 text/plain 13340`,
`/index.md 200 text/markdown 5907`, `/.well-known/agent-card.json 200
application/json 4926`, plus `/og-image.png 200 image/png 53927`. GPTBot,
ClaudeBot and PerplexityBot each confirmed getting 200 on `/llms.txt`,
`/robots.txt` and the agent card. The JSON-LD parses **from the live response**
with 4 nodes, 0 orphan `@id` references, `Offer` `0 USD`, and both parent entity
`@id`s intact. Decision row 7's redirect re-confirmed: `www` and
`pdfedittoolkit.netlify.app` both 301 to the apex. **Re-audit score: 33.5/41
(82%), up from 11/40 (27.5%).** What is still open is unchanged and remains the
four tickets: the served body is still `<div id="root"></div>` with 0 visible
text characters (`served-html-has-no-crawlable-content.md`, worth ~5.5 of the
remaining 7.5 points because five other rows are downstream of it), every URL
still returns 200 (`every-url-returns-200-soft-404.md`), the FAQ markup still has
no visible counterpart (`faq-markup-has-no-visible-counterpart.md`), and the
Google Fonts stylesheet plus the 1.38 MB entry chunk still block first paint
(`pdfjs-bundled-into-entry-chunk.md`). Remaining manual step for the user:
submit `sitemap.xml` in Search Console once the property finishes verifying.]

---

**2026-07-23 — Bulk-action bar moved from the bottom of the viewport into the
sticky header. ✅ DONE.** The user reported the multi-select bar was "barely
visible" at `bottom-6`. It is now a row inside the sticky header, rendered by
`AppHeader` directly under the toolbar, so it appears beside the other controls
(Export, Reset, page size) and stays on screen while the grid scrolls. The
obvious first attempt — the same `fixed` bar re-anchored to the top — was built
and rejected on evidence: it overlays the first grid row and swallows those
pages' checkbox and rotate/annotate/delete buttons (`agent-browser` refused the
click with `covered by <button.inline-flex> ... the input would land on that
element instead`). Rendering it in the header's normal flow makes overlap
structurally impossible; the grid shifts down while a selection is active and
back on Clear. Because the header's height is not a constant (the toolbar row
only exists once pages load, and both rows wrap on mobile), the new
`useCssHeightVariable` hook publishes the header's measured border-box height
on `:root` as `--app-header-height` via `ResizeObserver`; the sticky source
legend now uses `calc(var(--app-header-height,112px)+1rem)` instead of the
hardcoded — and already slightly wrong — `lg:top-[112px]`. Within the bar, the
divider before Select all / Clear gained `ml-auto` so those two push to the
right edge of the full-width row. **Proof:** `npx tsc -b` clean; `npm run lint`
unchanged at 4 pre-existing warnings (`button.tsx`, `ThumbnailGrid.tsx` ×3 —
all pre-existing); `npm run build` green. Verified live via `agent-browser`
against the dev server with a generated 6-page PDF: at 1280×912 the bar renders
as a header row reading "2 selected" with Select all / Clear right-aligned,
pages 1 and 3 show their checkmarks and **no** thumbnail control is covered; at
1280×700 scrolled 600px the bar and the legend stay pinned while the grid
scrolls beneath; at 390×780 it wraps to two lines of icon-only buttons (header
+ bar then occupies ~42% of the viewport — accepted, see decision row 12);
Clear removes the row and the header and legend return to their original
offsets. **Files:** added `src/hooks/useCssHeightVariable.ts`; edited
`src/components/BulkActionBar.tsx`, `src/components/AppHeader.tsx`,
`src/components/PdfToolkitView.tsx`. **Decisions:** row 12.

---

**2026-07-23 — Free-hand / straight-line highlighter (`'freehand-highlight'`),
a second highlight tool drawn directly on the page. ✅ DONE.** The per-page
annotate menu's single "Highlight" split into **"Highlight text"** (today's
text-aware tool, unchanged, PDF-only) and a new **"Highlight"** — a free-hand
highlighter you draw over the page, with a **Free / Line** mode toggle, an
**S / M / L** thickness selector, and the existing colour swatches. It is a new
annotation *kind* assembled from parts that already existed: a pure-state
capture hook modelled on `useSignatureStrokes` (`useFreehandStrokes`, with a
`line` mode that keeps the stroke a two-point `[start, current]` segment), one
`<svg>` of round-joined paths in a single `mix-blend-multiply` layer
(`HighlightInkSvg`, shared by the modal preview and the placed overlay), and a
raster export that rasterizes the same `strokes` to a flat-colour transparent
PNG stamped with `BlendMode.Multiply` — so preview and export multiply over the
page exactly once and stay pixel-faithful. Screen and export curves are
guaranteed identical by a shared `strokeControlPoints` (extracted from
`traceStroke`) that both the canvas tracer and the SVG-path builder consume.
Drawn highlights are **fixed, remove-only** (like text-highlights) and are
**available on image pages too**, making scanned/image pages highlightable for
the first time. No coordinator/context changes were needed — the pipelines are
generic over `AnnotationPlacement`. `ColorSwatches` was extracted from the
text-highlight modal into a shared component so both dialogs use it.
**Proof:** `npx tsc -b` clean; `npm run lint` unchanged at 4 pre-existing
warnings (`button.tsx`, `ThumbnailGrid.tsx` ×3 — all predating this change);
`npm run build` green, **394 modules** (up from 388: 4 new files + the shared
`ColorSwatches`). The discriminated-union exhaustiveness check confirmed every
`switch` gained its `'freehand-highlight'` branch. Verified live via
`agent-browser` against the dev server with a generated 2-page text PDF and a
striped PNG: (1) the PDF annotate menu shows **both** "Highlight text" and
"Highlight"; (2) a free-hand squiggle drew as a smooth translucent stroke with
the text legible underneath (multiply), and Line mode drew a straight rounded
bar; (3) S→L thickness and colour changes applied; (4) both marks appeared on
the **grid thumbnail**; (5) in **Move & resize** the drawn highlights showed a
remove button and **no** resize handle (measured 2 remove / 0 resize) and a
remove click dropped a mark (2→1); (6) rotating the page 90° rotated the
highlight **with** the content, and the exported PDF confirmed it stayed aligned
under rotation; (7) an **export** rendered via `pdftoppm` showed a smooth
free-hand squiggle and a straight bar both multiply-blended over legible text,
visually matching the on-screen preview (parity); (8) on an **image** page only
"Highlight" was offered (not "Highlight text"), drawing worked (squiggle showed
olive where it crossed the image's darker bars = multiply), and its export kept
the mark. Note: under `agent-browser` the `PreviewSurface` overlay
occasionally needed a screenshot-forced reflow before its `ResizeObserver`
measured — reproduced identically on the *existing* text-highlight modal, so it
is a pre-existing automation-timing quirk, not introduced here.
**Files:** added `src/components/freehand/useFreehandStrokes.ts`,
`src/components/freehand/HighlightInkSvg.tsx`,
`src/components/freehand/FreehandHighlightModal.tsx`,
`src/components/annotations/ColorSwatches.tsx`,
`src/managers/annotation/FreehandHighlightStamper.ts`; edited
`src/domain/types.ts`, `src/lib/annotationStyles.ts`,
`src/lib/signatureGeometry.ts`, `src/lib/strokeRendering.ts`,
`src/components/annotations/AnnotationOverlay.tsx`,
`src/components/highlight/HighlightAnnotateModal.tsx`,
`src/managers/annotation/AnnotationStamper.ts`,
`src/managers/PageListManager.ts`,
`src/components/annotations/AnnotateMenu.tsx`,
`src/components/PdfToolkitView.tsx`.
**Cross-refs:** decision row 11 (new kind, raster+single-multiply export,
fixed/remove-only, image-page availability); builds on the signature ink
pipeline and the frozen-rotation `computePdfPlacement` convention.

---

**2026-07-23 — Dropped the indigo selection ring on page thumbnails; the
checkbox tick is the sole selection cue. ✅ DONE.** Follow-up to the entry below
at the user's request ("remove the second selection border, the V is enough").
The ring (`ring-2 ring-primary ring-offset-2`) that decision row 10 added so
selection and source colour could coexist read as a competing second border next
to the source-coloured `border-2`; the persistent top-left checkmark already
marks a selected page unambiguously, so the ring was redundant. Now a selected
page keeps only its source-colour border + the tick. This refines the
selection-treatment detail of row 10 (the palette decision itself is unchanged;
the concern row 10 solved — selection not hiding the source colour — still holds,
now via the tick rather than a ring).
**Proof:** `npx tsc -b` clean; `npm run lint` unchanged at 4 pre-existing
warnings. Verified live via `agent-browser`: with 4 contract pages selected, each
showed the indigo checkmark and its blue source border only — no ring — while the
bulk bar read "4 selected".
**Files:** `src/components/PageThumbnail.tsx`.
**Cross-refs:** the entry below; decision row 10.

---

**2026-07-23 — Per-source file legend + colour-coded page borders. ✅ DONE.**
When several PDFs/images are merged the grid was one undifferentiated list of
pages; now each uploaded file gets a distinct colour, shown as a side legend
(dot + filename + page count, one row per file) and as the tint of every page
thumbnail's border, so the merge composition is legible at a glance. The legend
is interactive: clicking a file selects exactly its pages (toggles off when they
are already the whole selection), and a per-row trash button removes all of that
file's pages. Colour is assigned by a new `SourceColorRegistry` (lowest-free
palette slot, idempotent per `sourceId`, slot freed on source garbage-collection)
so a file's colour is stable across page reordering and unrelated add/remove.
Selection moved from a `border-primary` swap to an indigo **ring**, so a selected
page shows its source colour *and* the selection simultaneously (chosen with the
user in planning, along with the select+remove legend behaviour).
**Proof:** `npx tsc -b` clean; `npm run build` green (388 modules); `npm run lint`
unchanged at 4 pre-existing warnings (`button.tsx`, `ThumbnailGrid.tsx` — the two
new deps-array warnings in `ThumbnailGrid` predate this change). Verified live via
`agent-browser` against the dev server with 2 generated PDFs (4 + 3 pages) + 1
PNG: header read `8 pages · 3 files loaded`; legend listed all three with matching
dots; page borders were blue (contract, 4), red (report, 3), green (image, 1);
clicking the report row selected exactly pages 5–7 with the indigo ring drawn
*around* the still-visible red border; clicking it again cleared; the trash button
on contract removed its 4 pages and its legend row, and the survivors kept red/
green (blue was released, not reassigned) — confirming stable assignment.
**Files:** added `src/lib/sourceColors.ts`, `src/managers/SourceColorRegistry.ts`,
`src/components/SourceLegend.tsx`; edited `src/coordinator/PdfToolkitCoordinator.tsx`,
`src/coordinator/toolkitContext.ts`, `src/hooks/useSelection.ts`,
`src/components/ThumbnailGrid.tsx`, `src/components/PageThumbnail.tsx`,
`src/components/PdfToolkitView.tsx`.
**Cross-refs:** decision row 10 (categorical palette as a scoped exception to
the single-accent brand of row 5).

---

**2026-07-23 — Self-hosted counters verified live and seeded to the dashboard
numbers. ✅ DONE.** Closes the two 🟡 PARTIAL entries below (the Umami→`/api/track`
re-plumb and the strong-consistency fix), both now confirmed in production on
deploy `b093343`. The strong-consistency CAS accumulates correctly: a delta-seed
reading current totals and POSTing only the shortfall reached the target on the
first iteration — `posted=16`, and the two counts already present (a `pages-removed`
and a stray `file-added` from earlier diagnostics) were absorbed by the delta logic
rather than double-counted.
**Proof:** public `GET /api/usage` (the exact unbusted path the browser fetches)
returns `{"annotation-added":5,"file-added":5,"signature-added":3,"pages-rotated":2,
"pdf-exported":2,"pages-removed":1}` — grandTotal 18, so `UsageCounters` clears its
`MINIMUM_TOTAL_TO_SHOW = 5` gate and the panel renders. CDN observed refreshed
(`age: 0`, `cache-status: … stored`). `pages-resized` and `pages-reordered` remain
0 (not in the dashboard snapshot), matching intent.
**Files:** `docs/PROGRESS.md` (this entry).
**Cross-refs:** decision rows 8 and 9; verifies the "to be re-verified on this
redeploy" note left in row 9.

---

**2026-07-23 — Counter increment was lossy in production: CAS over eventual
consistency; fixed with `consistency: 'strong'` (one-line store change). 🟡 PARTIAL.**
Found while seeding the new counters (previous entry) with the live dashboard
numbers: after POSTing 18 events to `/api/track`, `/api/usage` read back `{}` and
the raw function (cache-busted with `?x=`, honoured per the `netlify-vary: query`
response header) showed **only `{"pages-removed":1}`** — the 18 writes had
collapsed to the single last one. Root cause: `incrementEvent` is a read-modify-write
compare-and-swap, but `getStore('usage')` defaults to *eventual* consistency, so
each increment read a stale (often empty) replica and its `onlyIfMatch`/`onlyIfNew`
condition passed against that stale view — writes clobbered instead of accumulating.
CAS is only sound against strongly-consistent reads. Fix: open the store with
`{ consistency: 'strong' }`; the retry loop is otherwise unchanged. Read latency is
irrelevant because `/api/usage` is CDN-cached 15 min.
**Proof:** production collapse captured — `curl .../.netlify/functions/usage-counters?x=<rand>`
→ `{"pages-removed":1}` after an 18-event seed. Post-fix `npm run build` green,
`npx tsc -p tsconfig.netlify.json` green, `npm run lint` unchanged at 4 pre-existing
warnings.
**What remains:** deploy, then re-seed to the dashboard target by reading current
totals and POSTing the *delta* per event (robust to whatever residue the broken run
left), and confirm the raw function shows totals accumulating, not collapsing.
**Files:** `netlify/lib/usageStore.ts`, `docs/DECISIONS.md`.
**Cross-refs:** decision row 9 (corrects the concurrency claim in row 8).

---

**2026-07-23 — Umami removed; public counters re-plumbed onto a self-hosted
`/api/track` → Netlify Blob increment (code + docs; no deploy yet). 🟡 PARTIAL.**
The trigger was the counters showing nothing on the live site despite 18 events in
the Umami dashboard. Root cause found and confirmed live, not assumed: the counters
never read Umami directly — they read a `totals` blob written by an hourly job that
pulls counts *back* from Umami's API, and that API needs a key Umami Cloud only
issues on a **paid** plan. So `/.netlify/functions/snapshot-usage` was 500-ing every
run (`Missing required environment variable: UMAMI_WEBSITE_ID`) and `/api/usage` was
returning `{}`. The `MINIMUM_TOTAL_TO_SHOW = 5` threshold the user asked about was a
red herring — `UsageCounters` bails on `if (!totals) return null` *before* the
threshold is ever compared, so an empty backend hides the panel regardless of count.
Fix, per the user's call to drop Umami rather than pay: deleted the whole
Umami→snapshot pipeline and added a public `POST /api/track` that increments the same
`totals` blob directly, via a compare-and-swap loop (ETag + conditional `setJSON`) so
concurrent writes don't lose counts. The read path (`usage-counters.ts`, `/api/usage`,
`useUsageCounters`, `UsageCounters.tsx`) is unchanged — it already read that blob.
Browser side, `UmamiAnalyticsManager` is replaced by `NetlifyCountersAnalyticsManager`
(posts only the event *name*, fire-and-forget with `keepalive`); the Umami `<script>`
and its `window.umami` typing are gone. Preview/dev isolation is preserved two ways:
the dev no-op tracker, plus a canonical-`Host` guard in the function so previews and
the `.netlify.app` subdomain can't write production counts.
**Proof:** `npm run build` green; `npx tsc -p tsconfig.netlify.json` green;
`npm run lint` unchanged at 4 pre-existing warnings (`button.tsx`,
`ThumbnailGrid.tsx` — none in touched files); post-change grep for
`umami|snapshot|UMAMI_|lib/days|window.umami` across `src/ netlify/ index.html
netlify.toml tsconfig*` returns only intentional historical comments. Pre-change
live state captured above (`/api/usage` → `{}`, snapshot fn → 500).
**What remains:** unverified live — function and `netlify.toml` changes are inert
until deployed. After deploy: confirm a tracked action makes `/api/track` return 204
and `/api/usage` climb, the panel appears once total ≥ 5, and a preview host is
rejected. Not committed; no commit was requested.
**Files:** added `netlify/functions/track-usage.ts`,
`src/analytics/NetlifyCountersAnalyticsManager.ts`,
`docs/tickets/track-endpoint-is-publicly-inflatable.md`; deleted
`netlify/functions/snapshot-usage.ts`, `netlify/lib/umamiClient.ts`,
`netlify/lib/days.ts`, `src/analytics/UmamiAnalyticsManager.ts`,
`src/types/umami.d.ts`; edited `netlify/lib/usageStore.ts`,
`netlify/functions/usage-counters.ts`, `src/analytics/createAnalyticsTracker.ts`,
`src/analytics/eventNames.ts`, `src/analytics/AnalyticsTracker.ts`,
`src/components/usage/UsageCounters.tsx`, `index.html`, `netlify.toml`, `README.md`,
`docs/DECISIONS.md`, and the two retired tickets.
**Cross-refs:** decision row 8 (supersedes rows 2, 4, 6). Closed tickets
`snapshot-usage-endpoint-is-publicly-triggerable.md` and
`umami-free-tier-overage-behaviour-unknown.md`; opened
`track-endpoint-is-publicly-inflatable.md`.

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
