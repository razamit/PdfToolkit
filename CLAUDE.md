<!-- devlog:start -->
## Devlog

This project keeps a written record. Maintain it without being asked.

- **Starting work** — read the head of `docs/PROGRESS.md` (newest entry
  first) to learn current state, and check `docs/DECISIONS.md` before
  proposing anything it may have already settled. Existing decision rows are
  binding: supersede one deliberately with a new row, never silently.
- **Noticing a defect or gap you will not fix now** — file a ticket in
  `docs/tickets/` (Symptom → Evidence → Why it matters → Scope to decide).
  Never leave it as a TODO comment, a silent skip, or a remark in chat.
- **Making a consequential choice** — record it in `docs/DECISIONS.md` with
  its why and the alternatives rejected. A decision whose reasons are not
  written down will be reversed by a future session that cannot see them.
- **Finishing a unit of work** — prepend an entry to `docs/PROGRESS.md`:
  status marker, scope note, real proof (actual test output, before/after),
  files touched, cross-refs. State red tests honestly; never imply
  completeness you have not verified.
- **Before any requested commit** — evidence summary naming every path in
  `git status --short` / `git diff --stat`, including incidental edits and
  deletions, verified against the actual diff; then the log updates above,
  in the same commit as the work; then commit. Never commit unless the user
  explicitly asked.

The `devlog` plugin skills (`progress-log`, `decision-log`, `tickets`,
`session-wrap`) hold the full conventions — read the relevant one before
writing to these files.
<!-- devlog:end -->

## Discovery surfaces must move together

The product is described in six places at once. Answer engines cross-check them
and downrank a site whose surfaces disagree, so they are maintained as one unit,
never one at a time.

**When any user-facing claim changes** — a feature added or removed, a supported
file type, the privacy posture, the price, the product name — update all of
these in the *same commit* as the code:

| Surface | Path | What to change |
|---|---|---|
| Head metadata | `index.html` | `<title>`, meta description, `og:*`, `twitter:*` |
| Structured data | `index.html` | The `application/ld+json` `@graph`: `featureList`, `description`, and the `FAQPage` answers |
| Agent summary | `public/llms.txt` | Tagline, "What it does", "What it does not do", `Last verified` |
| Agent briefing | `public/llms-full.txt` | The affected section, the FAQ, `Last verified` |
| Markdown twin | `public/index.md` | The mirrored section, `Last verified` |
| Agent card | `public/.well-known/agent-card.json` | `description`, `skills`, `lastVerified` |
| Sitemap | `public/sitemap.xml` | Bump `<lastmod>` to today |

Two hard rules:

- **The `FAQPage` answers in `index.html` and the visible on-page FAQ must be
  word-for-word identical.** Both live in `index.html`: the answers in the
  `application/ld+json` block and the same text in the
  `<section class="landing">` block below `#root`. Structured data with no
  visible counterpart is a Google policy violation, so editing one without the
  other reintroduces `docs/tickets/faq-markup-has-no-visible-counterpart.md`.
- **The landing content must stay OUTSIDE `<div id="root">`.** React's
  `createRoot(...).render()` clears its own container's children, so moving that
  block inside `#root` would delete it on mount and silently return the served
  body to zero visible text. It is also the page's only `<h1>`; `AppHeader`
  deliberately uses a `<p>` so the rendered page does not have two.
- **`netlify.toml` must never regain a `/*` catch-all rewrite.** The site is
  served as ordinary static files so that unmatched paths reach `public/404.html`
  with a real 404 status. A `/*` → `/index.html` rule makes every path on the
  domain answer 200 with the app shell, which is what previously turned scanner
  probes (`/wp-admin/install.php`, `/xmlrpc.php`) into recorded pageviews and
  every mistyped URL into an indexable soft-404. See decision row 22.

## Adding a second page means revisiting the routing rules

The no-catch-all rule above assumes what is true today: the app renders one view
and has no client-side router. **Anything that changes that — a real route, a
client-side router, a second HTML entry point, a `/blog` or `/tools/*` path —
requires reopening decision row 22 in the same change**, because without a
rewrite those paths will 404 in production while working perfectly in dev.

The fix at that point is a rewrite **scoped to the real route paths**
(`from = "/tools/*"`), never `/*`, and **never with `force = true`**: a forced
rewrite beats matching static files, which is the only thing keeping
`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/index.md` and
`/.well-known/agent-card.json` reachable by a crawler instead of answering all
six with the app shell. New pages also need their own `<url>` entries in
`public/sitemap.xml` and a pass over every surface in the table above.

A change is not verified by reading the repo. These files are only real once
deployed, so re-probe the live URL (`curl -sI https://freepdfmachine.com/llms.txt`)
and check the status and `Content-Type`, not just that the file exists in `dist/`.
Routing changes specifically need three live probes: a discovery file
(`curl -sI https://freepdfmachine.com/llms.txt` → 200 `text/plain`), the root
(`/` → 200 HTML), and a junk path
(`curl -sI https://freepdfmachine.com/does-not-exist-404test` → **404**).
