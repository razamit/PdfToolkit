# Word (.docx) and PowerPoint (.pptx) files cannot be added to a document

Status: OPEN · Priority: MEDIUM · Type: missing feature · Cost: none

> This is the deferred half of the 2026-08-06 request that shipped CSV/XLSX
> import (decision row 32). It is not a defect in that work — the scope was cut
> deliberately — but the research behind the cut is recorded here so a future
> session does not repeat it. Distinct from
> `spreadsheet-conversion-does-not-reproduce-workbook-formatting.md`, which is
> about the fidelity of the formats that *are* supported.

## Symptom

The user asked for "csv/excel/word/ppt" support. CSV and Excel shipped;
`.docx` and `.pptx` are rejected by `loadFile` in
`src/coordinator/PdfToolkitCoordinator.tsx` with `"<name>" isn't a PDF, image,
or spreadsheet we can read.` They are not even named in
`UNREADABLE_FORMATS` in `src/managers/SheetImportManager.ts`, so the message
does not tell the user that these are known-but-unsupported rather than
unrecognized.

## Evidence

The two shipped formats reached parity with the request because a spreadsheet
has no layout of its own to reproduce — a table of values *is* the document.
Word and PowerPoint do not have that property, which is why they were split
off rather than batched in:

```
Route A (what CSV/XLSX shipped on): parse to a model, draw with pdf-lib.
  DOCX  → needs a flow layout engine (line breaking, styles, lists, floats,
          headers/footers, pagination). Weeks of work, and still not WYSIWYG.
  PPTX  → non-starter. Slides are absolutely-positioned shape trees with
          theme inheritance; there is no "values" abstraction to fall back to.

Route B (viewer library → rasterize → import as image pages):
  docx-preview (MIT) already implements pagination, styles, numbering, tables
  and headers/footers; a PPTX canvas renderer covers slides. Rasterize with
  html2canvas/foreignObject → PNG → the existing image-page path.
  Cost: output is raster (large, not selectable), fonts the document names
  (Aptos, Calibri) are absent and get substituted, so text reflows.
  Refinement worth the extra day: after rendering, read the DOM's text Range
  rects and inject them as an invisible positioned text layer — the same trick
  `OcrManager` uses for scans, but with exact text instead of OCR guesses.
  That restores selectable/searchable output on top of a faithful raster.

Routes ruled out entirely:
  LibreOffice WASM (ZetaOffice): ~50 MB initial + ~250 MB resources, requires
    COOP/COEP cross-origin isolation on the whole document, still open beta,
    supported CDN is a paid package. Incompatible with a 1.4 MB entry chunk
    and a PWA that precaches its graph.
  Commercial client-side SDKs (Nutrient/PSPDFKit, Apryse, docx-wasm): good
    fidelity, stays on-device, all license-key gated at commercial pricing.
  Server-side LibreOffice or a conversion API: best fidelity, least code, and
    it breaks the claim the whole product rests on (decision rows 3, 17, 29,
    30 and every discovery surface). Ruled out on principle, not on effort.
```

## Why it matters

"Convert Word to PDF" is by a wide margin the highest-volume search term of the
four formats in the original request, so this is the largest single piece of
growth upside left on the table under the traffic thesis of decision row 17.

Against that: a DOCX converter that reflows the user's document is worse than
no converter, because it fails the expectation the search term carries — the
user expects the PDF to look like what Word shows. CSV/XLSX carried almost none
of that risk, which is why they went first.

## Scope to decide

- Option A — Build DOCX via Route B plus the DOM-derived invisible text layer,
  shipped behind copy that says "converted layout — close, not identical".
  Then judge PPTX on how the raster pipeline is actually received.
- OR Option B — Add `.docx`/`.pptx`/`.doc`/`.ppt` to `UNREADABLE_FORMATS` so
  the rejection at least explains itself, and leave conversion unbuilt. Cheap,
  honest, and reversible.
- OR Option C — Leave as is.

No code change made by this ticket — it is an observation on the record.
