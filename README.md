# Free PDF Machine

[freepdfmachine.com](https://freepdfmachine.com)

A private, in-browser PDF editor. Feed in one or more PDFs (and JPEG/PNG images),
see every page as a thumbnail grid, then rotate, remove, reorder (drag-and-drop),
resize, sign, annotate, and export a new PDF — all **without ever uploading your
files to a server**, and **without losing any quality**.

## Quality guarantee

The app never re-rasterizes your content on export. It separates two concerns:

- **Display** uses [pdf.js](https://mozilla.github.io/pdf.js/) to render thumbnails
  to a canvas — for preview only. These pixels are never exported.
- **Export** uses [`@cantoo/pdf-lib`](https://www.npmjs.com/package/@cantoo/pdf-lib),
  which works at the PDF-object level: `copyPages` copies original page content
  byte-for-byte, rotation is stored as the page's `/Rotate` metadata, and JPEGs are
  embedded with their original bytes intact (PNGs are re-encoded losslessly via Flate).

The exported PDF is rebuilt from the original source bytes, so proportions,
resolution, and quality are preserved exactly.

## Features

- Combine multiple PDFs and images into one working document
- Thumbnail grid with an adjustable size slider (more/fewer per row)
- Rotate, delete, and reorder pages (drag-and-drop)
- Resize pages to A4 / Letter / the document's dominant size, or keep originals
- Draw and place signatures, with a reusable session library
- Text, image, and highlight annotations, with drag-to-rearrange
- Multi-select for bulk rotate / delete / export
- Export all pages, or just the selected ones
- 100% client-side — files never leave the browser

## Tech stack

React 19 · Vite · TypeScript · Tailwind v4 · `@cantoo/pdf-lib` · `pdfjs-dist` · `@dnd-kit` · lucide-react

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Analytics and the privacy promise

The site reports anonymous usage counts to [Umami](https://umami.is) — cookieless,
no persistent identifier, and therefore no consent banner.

**Only counts and fixed enum values are ever sent.** No filenames, no annotation
text, no image data, no page dimensions. This is enforced by the type system, not
by convention: `AnalyticsEventShape` restricts event properties to
`string | number | boolean`, so passing a filename to `track` is a compile error.
`src/analytics/privacyGuarantee.typetest.ts` pins that guarantee with
`@ts-expect-error` assertions that fail the build if it is ever weakened.

Tracking is disabled in development, and the `data-domains` attribute on the
script tag stops Netlify deploy previews from reporting into production data.

## Public usage counters

The landing page shows lifetime totals ("The machine so far"). Umami's API key
must stay server-side, so the browser never queries it directly:

1. `netlify/functions/snapshot-usage.ts` runs hourly, reads the recent days'
   event counts from Umami, and stores them in Netlify Blobs keyed by UTC date.
2. `netlify/functions/usage-counters.ts` serves the summed totals at `/api/usage`.

The page never queries Umami directly, so the counters are only as fresh as that
job: expect up to an hour of lag, plus 15 minutes of CDN cache.

Snapshots — not Umami — are the source of truth, because Umami's free tier retains
only six months and an all-time query would eventually make the counters *fall*.
Storing by date also makes the job idempotent, so re-running it never double-counts.

Counters stay hidden until there are at least 5 events in total (summed across all
eight, not per counter).

## Deploying to Netlify

`netlify.toml` is included. Build command `npm run build`, publish directory `dist`,
functions directory `netlify/functions`.

Set these environment variables in the Netlify UI (Site configuration → Environment
variables) for the counters to work:

| Variable | Required | Notes |
|---|---|---|
| `UMAMI_WEBSITE_ID` | yes | From the Umami dashboard. |
| `UMAMI_API_KEY` | yes | Umami Cloud → Settings → API keys. **Server-side only.** |
| `UMAMI_API_BASE` | no | Defaults to `https://api.umami.is/v1`. |

The app itself needs none of these — without them the counters simply stay hidden
and everything else works.

To populate history immediately rather than waiting for the first scheduled run:

```bash
curl "https://freepdfmachine.com/.netlify/functions/snapshot-usage?backfill=30"
```

## Architecture

- `src/managers/` — framework-agnostic business logic: source loading, thumbnail
  rendering, the lossless export pipeline, and pure page-list transforms.
- `src/coordinator/` — owns all working state and wires the managers together.
- `src/analytics/` — provider-agnostic tracking. Nothing outside this folder
  imports a vendor SDK, so swapping backends is a one-file change.
- `src/hooks/` — UI logic (selection, lazy thumbnails, drag-and-drop, uploads).
- `src/components/` — presentation only.
- `netlify/functions/` — the scheduled snapshot job and the public counters endpoint.
- `netlify/lib/` — shared function code, kept out of `functions/` so Netlify does
  not deploy it as endpoints.

## Project log

`docs/PROGRESS.md` (what happened, newest first), `docs/DECISIONS.md` (why, with
alternatives rejected), and `docs/tickets/` (known gaps).
