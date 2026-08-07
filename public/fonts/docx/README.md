# Metric-compatible substitution fonts for Word conversion

These exist for one reason: a `.docx` names the fonts it wants — overwhelmingly
**Calibri** (Word's default for over a decade) and **Cambria** — and those fonts
are not on the machine doing the conversion. Without a substitute at the *same
metrics*, every line breaks in a different place than it did in Word, and the
converted page stops matching the document the user is looking at.

| Bundled | Substitutes for | Licence |
|---|---|---|
| Carlito (Regular/Bold/Italic/BoldItalic) | Calibri, Calibri Light | SIL OFL 1.1 |
| Caladea (Regular/Bold/Italic/BoldItalic) | Cambria | SIL OFL 1.1 |

Arial and Helvetica are already covered by `../LiberationSans-Regular.ttf`,
which the annotation pipeline bundles and which is metric-compatible with both.

`OFL.txt` is the SIL Open Font License 1.1 that both families are released
under; it is distributed here because the licence requires the licence to travel
with the fonts.

## Why these are not in the service worker's precache list

`public/service-worker.js` precaches a small, fixed shell. These files total
~2.6 MB, which would more than double the offline install for a capability most
visitors never use. They are instead picked up by the worker's `cacheFirst`
handler on first use, so the first Word conversion needs a connection and every
later one — including offline — is served from cache. That is the same bargain
the OCR language model already makes, and the public copy describes it the same
way.

## Why TTF rather than WOFF2

Google Fonts serves these two families as TTF, not WOFF2, so there is no smaller
build to fetch. They are **not** embedded into the exported PDF: the visible page
is a raster of the browser's own rendering, and the invisible text layer is drawn
with Liberation Sans, which is already bundled and already verified to survive
`@pdf-lib/fontkit`. Nothing here goes near that code path.
