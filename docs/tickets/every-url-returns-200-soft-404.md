# Every URL on the domain returns HTTP 200 with the app shell, so mistyped and dead URLs are indexable soft-404s

Status: OPEN · Priority: MEDIUM · Type: SEO — crawlability · Cost: none

> Distinct from `served-html-has-no-crawlable-content.md`, which is about what
> the response body contains. This one is about the status code and which paths
> answer at all. The two share a cause (`netlify.toml`'s SPA catch-all) but have
> independent fixes.

## Symptom

The SPA catch-all in `netlify.toml` rewrites every unmatched path to
`/index.html` with status 200. There is no `404.html` and no path that can
produce a 404, so any typo, any stale inbound link, and any speculative URL a
crawler tries returns a valid-looking page.

Present since the SPA catch-all was added.

## Evidence

```
$ curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
    https://freepdfmachine.com/this-page-does-not-exist-404test
200 text/html; charset=UTF-8 1508

$ curl -s -o /dev/null -w "%{http_code}\n" https://freepdfmachine.com/pricing
200
```

The rule, `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Note the same rule is load-bearing in the opposite direction: because it is
**not** `force`d, real static files win over it, which is the only reason
`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/index.md` and
`/.well-known/agent-card.json` reach a crawler at all after the 2026-07-23
change. Any fix must preserve that.

## Why it matters

Moderate, not urgent. Google treats a 200-with-generic-content response as a
soft 404 and generally declines to index it, so the practical harm today is
mostly wasted crawl budget rather than a polluted index. The site has exactly
one real URL, so there is very little surface for this to go wrong on.

It gets worse if the site ever acquires real paths, and it is already mildly
user-hostile: someone following a mistyped link gets the editor with no
indication that the URL they wanted does not exist.

## Scope to decide

- **Option A — a `public/404.html` plus a scoped catch-all.** Netlify serves
  `404.html` with a real 404 status for unmatched paths automatically once the
  catch-all no longer swallows them. The catch-all exists because the app is a
  SPA, but the app has no client-side router and no real routes (`src/App.tsx`
  renders one view), so the rewrite may not be needed at all. Verify that before
  removing it; if it is genuinely unused, deleting the rule is the whole fix and
  `404.html` starts working on its own.
- OR **Option B — keep the catch-all and accept the soft-404s.** Defensible
  while the site is a single page. Revisit the moment a second URL exists.

Whichever is chosen, re-probe `/this-page-does-not-exist-404test` afterwards and
re-probe all six discovery files, since they depend on the same rule not being
forced.

No code change made by this ticket — it is an observation on the record.
