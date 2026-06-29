# PDF Toolkit

A private, in-browser PDF toolkit. Upload one or more PDFs (and JPEG/PNG images),
see every page as a thumbnail grid, then rotate, remove, reorder (drag-and-drop),
bulk-edit, and export a new PDF — all **without ever uploading your files to a
server**, and **without losing any quality**.

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
- Multi-select for bulk rotate / delete / export
- Export all pages, or just the selected ones
- Reset to start over
- 100% client-side — files never leave the browser

## Tech stack

React 19 · Vite · TypeScript · Tailwind v4 · `@cantoo/pdf-lib` · `pdfjs-dist` · `@dnd-kit` · lucide-react

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deploying to Netlify

`netlify.toml` is included. Build command `npm run build`, publish directory `dist`.
Connect the repo (or drag-and-drop the `dist/` folder) and you're live — no backend
or environment variables required.

## Architecture

- `src/managers/` — framework-agnostic business logic: source loading, thumbnail
  rendering, the lossless export pipeline, and pure page-list transforms.
- `src/coordinator/` — owns all working state and wires the managers together.
- `src/hooks/` — UI logic (selection, lazy thumbnails, drag-and-drop, uploads).
- `src/components/` — presentation only.
