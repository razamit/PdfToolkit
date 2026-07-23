# The HTML served to crawlers and AI agents contains no body content, only an empty `<div id="root">`

Status: CLOSED (2026-07-23) · Priority: HIGH · Type: SEO/AEO — crawlability · Cost: none

> **Closed by a variant of Option A, see the "Resolution" section at the bottom.**
> Recorded in decision row 14 and in the 2026-07-23 progress entry. Also closes
> `faq-markup-has-no-visible-counterpart.md`, whose fix was the same work.

> This is the root cause behind three other findings and should be fixed before
> them: `faq-markup-has-no-visible-counterpart.md` (which cannot be closed until
> a visible FAQ exists on the page) and, less directly,
> `pdfjs-bundled-into-entry-chunk.md` (the bundle is currently the only source of
> any content at all, which is why its size is a content-delivery problem and not
> just a performance one). Distinct from `every-url-returns-200-soft-404.md`,
> which is about *which* URLs answer, not about what the answer contains.

## Symptom

`https://freepdfmachine.com/` serves 1,508 bytes whose entire `<body>` is:

```html
<body>
  <div id="root"></div>
</body>
```

Every word of textual content on the site is produced by
`/assets/index-*.js` (1.38 MB) after it parses and React mounts. A crawler or
agent that does not execute JavaScript therefore sees only the `<title>` and the
meta description. Present since the project's first deploy; `index.html` has
always been the stock Vite shell.

Concretely this fails five separate audit items: exactly one `<h1>` per page
(`src/components/AppHeader.tsx:25`, only after hydration), a first screen that
answers what/cost/privacy/how-to-start, a comparison section, outbound
cross-site links to the parent site, and the visible half of the FAQ.

## Evidence

```
$ curl -s -A "Mozilla/5.0" https://freepdfmachine.com/ | tail -5
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

$ for ua in "GPTBot/1.0" "ChatGPT-User/1.0" "ClaudeBot/1.0" "PerplexityBot/1.0" "Googlebot/2.1"; do \
    curl -s -o /tmp/b -A "$ua" https://freepdfmachine.com/; md5 -q /tmp/b; done
304177ad850ff56829ffe9b4bfb59316
304177ad850ff56829ffe9b4bfb59316
304177ad850ff56829ffe9b4bfb59316
304177ad850ff56829ffe9b4bfb59316
304177ad850ff56829ffe9b4bfb59316
```

All agent user agents receive byte-identical content to a browser, so there is
no bot challenge and no cloaking. The problem is that those identical bytes are
empty. The only headings that exist anywhere are post-hydration UI chrome:

```
$ grep -rn "<h1\|<h2" src/components/*.tsx
src/components/AppHeader.tsx:25:   <h1 ...>Free PDF Machine</h1>
src/components/EmptyState.tsx:14:  <h2 ...>Feed PDFs or images into the machine</h2>
src/components/SourceLegend.tsx:43: <h2 ...>   (source legend label)
```

## Why it matters

This is the single largest SEO and AEO gap in the project and it caps everything
else. The 2026-07-23 audit scored the site 11/40; the discovery-layer work landed
in the same session takes it to roughly 33/41, and this one ticket is worth about
5 of the remaining 8 points.

It matters more for answer engines than for Google. Googlebot does render
JavaScript, so it will eventually see the app, though on a delayed second-pass
crawl and with the app's UI chrome rather than descriptive prose. Most AI agents
do not render at all: GPTBot, ClaudeBot, PerplexityBot and CCBot fetch raw HTML.
For them the site currently has no content to quote, which is precisely the
opposite of what a product whose differentiator is a *claim* (files are never
uploaded) needs, because the claim has to be readable to be repeated.

The `/llms.txt`, `/llms-full.txt` and `/index.md` files added on 2026-07-23
mitigate this for agents that look for them, but they are a convention, not a
guarantee, and they do nothing for search.

## Scope to decide

- **Option A (recommended) — static landing content inside `#root` in
  `index.html`.** React's `createRoot(container).render()` clears the
  container's existing children on mount (`src/main.tsx:6`), so the block is
  visible to every crawler always, and to a human only during the pre-hydration
  moment, where it reads as a legitimate loading state rather than as hidden
  text. Zero new dependencies and no build step. Content needed: `<h1>`, a
  summary paragraph covering what/free/privacy/how-to-start, the feature list,
  the 7-question FAQ verbatim from the JSON-LD, the "vs online PDF editors that
  upload your files" comparison, and outbound links to
  `rzailabs.com/projects/free-pdf-machine` and
  `rzailabs.com/blog/free-pdf-editor-claude-code`. The cost to weigh: the block
  flashes before a 1.38 MB bundle parses, so it must be styled well enough to
  look deliberate, which argues for doing `pdfjs-bundled-into-entry-chunk.md`
  alongside it.
- OR **Option B — a prerender plugin** (`vite-prerender-plugin` or similar) that
  renders the real React tree to static HTML at build time. Keeps one source of
  truth for the markup, but adds a dependency and a build step, and what it
  emits is the app's UI chrome (a toolbar and an empty-state prompt), not the
  descriptive prose an agent needs. It solves the mechanism, not the content
  problem.
- OR **Option C — a separate static marketing page** at `/` with the app moved
  to `/app`. Cleanest separation and the best content surface, but it is a URL
  change on a live domain, needs redirects, and splits the product's identity
  across two pages for no benefit an in-page block does not already give.

No code change made by this ticket — it is an observation on the record.

## Resolution (2026-07-23)

Fixed with a variant of Option A that is strictly better than the version
proposed above, and the difference matters enough to record.

Option A as written put the static block *inside* `#root`, where
`createRoot(...).render()` wipes it on mount. That gets the crawler benefit but
means a person sees the content for one pre-hydration frame and then never
again, which satisfies the FAQ "visible counterpart" rule only on a technicality
and leaves the block's styling unverifiable in practice.

**What shipped instead: the block sits *after* `#root`, as a permanent section.**

```html
<body>
  <div id="root"></div>            <!-- React mounts here, owns the first screen -->
  <section class="landing">…</section>  <!-- static, React never touches it -->
  <footer class="site-footer">…</footer>
</body>
```

Because it is outside the container React owns, nothing clears it. Crawlers and
non-rendering agents read it from the raw HTML; people scroll to it below the
editor and it stays there. There is no pre-hydration flash and no
visible-versus-crawlable distinction at all, which removes the compliance
question rather than arguing it.

Two consequential side effects, both deliberate:

- The site `<footer>` moved out of `PdfToolkitView` into static HTML, because
  with landing content below the app the React-rendered footer would have sat
  *above* it in document order. It was pure static markup with no props or
  state, so nothing was lost.
- `AppHeader`'s `<h1>` became a `<p>`. It is a brand label in sticky chrome, not
  the document heading, and leaving it would have given the rendered page two
  `<h1>`s once the landing block added the real one.

Verified: served body went from **0 to 7,375 visible text characters**; exactly
one `<h1>` ("Free PDF editor that runs entirely in your browser"), 6 `<h2>`, 8
`<h3>`; all **7 FAQ answers confirmed word-for-word identical** to the
`acceptedAnswer.text` strings in the JSON-LD by script diff; 4 outbound
rzailabs.com links and the GitHub link now present in the body. `npm run build`
green, `npx tsc -b` clean, `npm run lint` unchanged at 4 pre-existing warnings.
Rendered and checked at 1280×900 and 390×780.
