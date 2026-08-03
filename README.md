# Free PDF Machine

[freepdfmachine.com](https://freepdfmachine.com)

A private, in-browser PDF editor. Feed in one or more PDFs (and JPEG/PNG images),
see every page as a thumbnail grid, then rotate, remove, reorder (drag-and-drop),
resize, crop, split, sign, annotate, fill forms, run local OCR, and export a new
PDF — all **without ever uploading document content to a server**.

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
- Insert editable blank pages (A4 for an empty document, otherwise matching the prevailing page size)
- Thumbnail grid with an adjustable size slider (more/fewer per row)
- Rotate, delete, and reorder pages (drag-and-drop)
- Resize pages to A4 / Letter / the document's dominant size, or keep originals
- Draw and place signatures, with a reusable session library
- Text, image, and highlight annotations, with drag-to-rearrange
- Undo/redo for up to 100 page-edit states
- Smart page-range splitting into a ZIP
- Percentage-margin crop for one, selected, or all pages
- Batch page numbers and text watermarks during export
- Fill and flatten supported standard AcroForm fields
- On-device English OCR that adds searchable text to selected pages
- Installable PWA with offline editing after the first online visit
- Multi-select for bulk rotate / delete / export
- Persistent multi-page action bar that explains when no pages are selected
- Export all pages, or just the selected ones
- 100% client-side — files never leave the browser

## Tech stack

React 19 · Vite · TypeScript · Tailwind v4 · `@cantoo/pdf-lib` · `pdfjs-dist` · Tesseract.js · `@dnd-kit` · lucide-react

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Analytics and the privacy promise

The site records anonymous usage counts to its own backend — no third-party
script, no cookies, no persistent identifier, and therefore no consent banner.

**Only event names are sent automatically.** Each tracked action posts a single event *name* to
`/api/track` and nothing else — no filenames, annotation text, image data, or even
the event's own properties. The stronger guarantee is still enforced by the type
system: `AnalyticsEventShape` restricts event properties to
`string | number | boolean`, so passing a filename to `track` is a compile error.
`src/analytics/privacyGuarantee.typetest.ts` pins that guarantee with
`@ts-expect-error` assertions that fail the build if it is ever weakened.

Tracking is disabled in development (the no-op tracker), and `/api/track` itself
only accepts writes from the canonical host, so Netlify deploy previews cannot
reach production counts even while running the same code.

The Feedback button is an explicit exception controlled by the user. It submits
the chosen category, message, and optional email address through Netlify Forms.
It never includes document content. The static hidden declaration in `index.html`
allows Netlify to detect the React-rendered form at deploy time.

## Public usage counters

The landing page shows all-time totals plus completed daily and weekly UTC views
("The machine so far"):

1. Each tracked action posts its event name to `netlify/functions/track-usage.ts`
   (`/api/track`), which increments that event's count in a single Netlify Blob.
   The increment is a compare-and-swap retry loop, so two overlapping requests
   never lose a count.
2. `netlify/functions/snapshot-usage.ts` captures those cumulative totals once a
   day at 00:00 UTC. The first successful capture for a date is immutable, so a
   retry cannot move the boundary and undercount the day.
3. `netlify/functions/usage-counters.ts` serves lifetime totals at `/api/usage`,
   while `netlify/functions/usage-history.ts` serves the 32 latest snapshots at
   `/api/usage/history`. Both reads are cached at the CDN for 15 minutes.

Daily and weekly totals are differences between exact snapshot boundaries. A
missing boundary leaves that period unavailable rather than combining multiple
days under a misleading label. History begins with the first snapshot after this
feature is deployed; existing lifetime totals cannot be reconstructed by date.

The lifetime totals blob remains the source of truth and only ever grows — there
is no external analytics dependency and nothing to reconcile.

Counters stay hidden until there are at least 5 events in total (summed across all
eight, not per counter), so a fresh deployment does not advertise single digits.

## Deploying to Netlify

`netlify.toml` is included. Build command `npm run build`, publish directory `dist`,
functions directory `netlify/functions`. Netlify Forms automatically provisions
the form named `feedback` from the declaration in the built `index.html`.

No environment variables are required. The counters run entirely on Netlify's free
tier (Functions + Blobs); the `usage` store is created on the first write.

## Architecture

- `src/managers/` — framework-agnostic business logic: source loading, thumbnail
  rendering, the lossless export pipeline, and pure page-list transforms.
- `src/coordinator/` — owns all working state and wires the managers together.
- `src/analytics/` — provider-agnostic tracking. Nothing outside this folder
  imports a vendor SDK, so swapping backends is a one-file change.
- `src/hooks/` — UI logic (selection, lazy thumbnails, drag-and-drop, uploads).
- `src/components/` — presentation only.
- `netlify/functions/` — the public counter endpoints (`/api/track`, `/api/usage`,
  `/api/usage/history`) and the daily snapshot schedule.
- `netlify/lib/` — shared function code, kept out of `functions/` so Netlify does
  not deploy it as endpoints.

## Project log

`docs/PROGRESS.md` (what happened, newest first), `docs/DECISIONS.md` (why, with
alternatives rejected), and `docs/tickets/` (known gaps).
