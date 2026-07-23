# pdf.js and the whole app ship in one 1.38 MB entry chunk that must parse before anything renders

Status: OPEN · Priority: MEDIUM · Type: performance — Core Web Vitals · Cost: none

> Related to `served-html-has-no-crawlable-content.md`: while the page has no
> static content, this chunk is the *only* source of anything a user sees, which
> makes its size an LCP problem rather than just a transfer-size one. If that
> ticket is fixed with a static block inside `#root`, this one determines how
> long that block sits on screen before the app takes over.

## Symptom

`npm run build` emits a single entry chunk containing the application, pdf.js
and pdf-lib together. Nothing renders until it has downloaded, parsed and
executed. pdf.js is only needed once the user picks a file, which most visitors
do seconds after landing, if at all.

## Evidence

```
$ npm run build
dist/assets/pdf.worker.min-DEtVeC4l.mjs  1,255.06 kB
dist/assets/index-BVDIQYJA.js            1,382.54 kB │ gzip: 488.11 kB
dist/assets/fontkit.es-C49EPJ7v.js         711.12 kB │ gzip: 329.68 kB
dist/assets/index-DJDaujtx.css              31.99 kB │ gzip:   6.50 kB

(!) Some chunks are larger than 500 kB after minification.
```

Vite's own warning names the fix. The worker and fontkit are already split out
and load lazily; the main library is not.

Serving was made worse by a missing cache header until 2026-07-23, when
`netlify.toml` gained `Cache-Control: public, max-age=31536000, immutable` for
`/assets/*`. Repeat visits are now free, so this ticket is about the first
visit only.

## Why it matters

488 kB gzipped of JavaScript before first paint is a Largest Contentful Paint
and Interaction to Next Paint cost on mobile connections, and page experience is
a ranking input. It is also the reason a pre-hydration static block (see the
related ticket) would be visible for a noticeable beat rather than a flash.

Not urgent in isolation: the site is a utility that people arrive at with a task
in hand, and the cache header removes the cost for anyone who returns.

## Fix

Dynamic-import the pdf.js entry point so it is fetched on the first file
selection instead of at page load. The codebase is already shaped for this: the
only *value* import of the library in the whole tree is
`src/lib/pdfjsWorkerSetup.ts:12` (`import * as pdfjsLib from 'pdfjs-dist'`), and
the one other reference, `src/managers/PdfSourceManager.ts:2`, is `import type`
and is erased at build time. So the import boundary is a single file. Verify with
`npm run build` that the entry chunk drops and a new lazy chunk appears, then
confirm in the browser that the first file selection still renders thumbnails
without a visible stall.

No code change made by this ticket — it is an observation on the record.
