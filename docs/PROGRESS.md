# Implementation Progress

Newest entry first. One entry per completed unit of work — dated headline,
scope note, status marker (✅ DONE / 🟡 PARTIAL / ⛔ NOT STARTED), proof,
files touched, cross-refs to decisions and tickets. Never rewrite old entries.

---

**2026-10-06: Exporting a PDF that contains a mislabelled image no longer fails
with "SOI not found in JPEG": image format is now read from the file's bytes
(offline, code + browser QA + docs). ✅ DONE.**
The user placed a `.jpeg` on a page as an image annotation and Export returned
the red banner "SOI not found in JPEG". Root cause: both image paths took the
format from `file.type`, which only echoes the extension, while the browser's
`<img>` sniffs content and previews the file regardless. A PNG named `.jpeg` was
therefore stored as `format: 'jpeg'` and handed to pdf-lib's `embedJpg`, whose
first check is that the bytes start `FF D8`. Three such files were sitting in the
user's Downloads (`file` reports "PNG image data" for `Western.jpeg`,
`DresageSilouhet.jpeg`, `Jumping.jpeg`). Fix: a new `src/lib/imageFormat.ts`
detects JPEG and PNG from their signatures, and both `readAnnotationImage`
(annotations) and `ImageImportManager` (image pages) use it in place of their
duplicated MIME tables. The annotation data URL and the image page's object URL
are rebuilt under the detected type so their label cannot disagree with the
stored format. **Proof:** old path reproduced against a 240x160 PNG fixture named
`png-named-as.jpeg`: `embedJpg` throws `SOI not found in JPEG`, `embedPng` on the
same bytes succeeds. Then in the running app (dev server, driven with
agent-browser): the fixture was added both as its own page and as an image
annotation on a PDF page; the pick step previewed it as
`data:image/png;base64,...`; Export produced a 164,517-byte `%PDF-1.7` with no
error banner, and `pdfimages -list` shows both copies embedded (pages 1 and 2,
240x160 rgb). A genuine JPEG added afterwards exported as a third page with
`enc jpeg`, 3,967 bytes, so the byte-identical JPEG path is unchanged.
`npx tsc -b` exits 0, `npm run build` green, `npm run lint` unchanged at 4
warnings. The project has no automated test suite, so there is no unit test for
the detector; the proof above is manual. **Not verified:** a WebP or HEIC file
named `.jpg`. By the code it is now refused at add time with the existing
"isn't a JPEG or PNG" message, where before it would have failed at export.
No user-facing claim changed (still JPEG and PNG only), so the discovery
surfaces were not touched. **Files:** added `src/lib/imageFormat.ts`; edited
`src/lib/readAnnotationImage.ts`, `src/managers/ImageImportManager.ts`,
`docs/{PROGRESS,DECISIONS}.md`; added
`docs/tickets/images-with-no-mime-type-are-rejected-before-their-bytes-are-read.md`.
Cross-ref: decision row 42; the new ticket records the same MIME assumption
still present in `loadFile`'s dispatch, left open.

---

**2026-08-09 — Removed Office conversion from the product: Word, spreadsheets and
the in-progress PowerPoint work all deleted; a dropped Office file is now told to
export a PDF from the app that made it (offline, code + browser QA). ✅ DONE.**
The session began building `.pptx` support and ended by removing the whole
category. A three-library bake-off was run first against a purpose-built deck
(slide masters, layout placeholders, theme inheritance, a native chart part, a
table, gradient and rotated shapes, mixed-run text): `pptx-viewer` rendered a
centred title left-aligned and lost the spaces between styled runs; `pptxviewjs`
dropped 3 of 7 bullets, painted a gradient fill solid black and produced a
*tainted* canvas that `toBlob` refuses to export; `pptx-preview` rendered an
empty chart, dropped a rotated shape, and turned out to be closed source despite
declaring ISC. `pptx-viewer` 0.3.0 was vendored (npm's 0.2.2 ships an unfixed XSS
where a crafted font name in a `.pptx` injects markup into the host page, and the
repo has no `prepare` script so a git dependency installs with no build output),
wired end to end, and **worked** — a 6-slide deck converted to a 1.25 MB PDF with
an invisible text layer. It was then discarded along with Word and spreadsheets,
on the user's argument that a print-to-PDF from the source application is always
better than an in-browser conversion. **Proof:** `npx tsc -b` exits 0,
`npm run build` green, `npm run lint` unchanged at 4 warnings. Entry chunk
1,458.21 kB → **1,426.54 kB** (gzip 511.73 → 500.49), measured against a
`git worktree` build of `origin/main`; the `docx-preview` (171 kB) and `snapdom`
(150 kB) chunks are gone. Across code and discovery surfaces, 3,684 lines deleted
against 161 added, plus 2.6 MB of bundled Carlito/Caladea fonts. In the running app a PDF and a PNG still load, the
single "Add files" picker and "Start blank" are intact, the format badges are
down to PDF and Images, and a `.pptx` returns "Open it in the app that made it
and choose File → Print → Save as PDF". All 8 FAQ answers verified word-for-word
identical between the JSON-LD and the visible page by a parser, and the JSON-LD
and agent card both re-validated. **Not done:** the app-path bug found just before
the reversal (the PPTX converter succeeded when called directly but `loadFile`
reported a generic failure) was never diagnosed — it died with the feature.
**Files:** deleted `src/lib/docx/` (10 files), `src/lib/sheets/` (8 files),
`src/managers/{DocxImportManager,SheetImportManager}.ts`, `docs/samples/` (2
fixtures), `public/fonts/docx/` (10 files); added `src/lib/unsupportedFiles.ts`;
edited `src/coordinator/PdfToolkitCoordinator.tsx`, `src/lib/fileAccept.ts`,
`src/components/{SupportedFormats,FileTypeBadge}.tsx`, `package.json`,
`package-lock.json`, `README.md`, `index.html`, `public/llms.txt`,
`public/llms-full.txt`, `public/index.md`,
`public/.well-known/agent-card.json`, `public/sitemap.xml`, and
`docs/{PROGRESS,DECISIONS}.md`. **Closed six tickets as won't-fix:**
`word-and-powerpoint-conversion-not-implemented`,
`spreadsheet-conversion-does-not-reproduce-workbook-formatting`,
`spreadsheet-number-formats-use-a-bounded-subset`,
`word-conversion-text-layer-has-three-gaps`,
`word-fields-and-repeating-table-headers-are-not-rendered`,
`snapdom-duplicates-text-in-multi-column-sections`. Cross-ref: decision row 41,
which reverses rows 32, 35, 37, 38, 39 and 40.

---

**2026-08-09 — Word `PAGE`/`NUMPAGES` fields now resolve; conversion split into
a planning pass and a rendering pass (offline, code + browser QA on seven
documents). ✅ DONE.** docx-preview does not evaluate fields — it drops the
field runs, so a real footer rendered as "Page  of ". The converter now resolves
them itself, which it is uniquely able to do: the page index is known while
paginating and the total only once every section has been paginated, so
`planSection` measures and chooses breaks for all sections before
`renderSection` draws anything. Because the rendered DOM holds no placeholder,
each field's position is read from the source XML as the count of literal text
runs preceding it, and the rendered spans are matched against that sequence by
text signature — necessary because the target may be a cloned default header.
**Proof:** a three-page fixture's footer reads "Page 1 of 3", "Page 2 of 3",
"Page 3 of 3", the last of those in a *different section*, so numbering carries
across section boundaries. All seven documents hold their page counts —
`letter` 2, `termination` 1, `litivest` 4, `hf` 1, `hf-long` 3, `stress_test` 13,
`stress_test_2` 3. `npx tsc -b` exits 0, `npm run build` green, `npm run lint`
unchanged at 4. **Two bugs hit while building it**, both recorded in decision
row 40: the parser assumed Word's canonical `begin`/instruction/`separate`/
`end` run split and silently dropped a generated fixture's fields, which put
`begin` and the instruction in one run with no `end`; and matching on the full
text signature was self-defeating, because writing page 1's number into a
cached-result run changed the text page 2 compared against, so page 2 kept
page 1's number. `docs/samples/stress_test_2.docx` gained a well-formed field
so both shapes are covered. Partially resolves
`docs/tickets/word-fields-and-repeating-table-headers-are-not-rendered.md` —
repeating table header rows remain open. **Files:** added
`src/lib/docx/docxFields.ts`; edited `src/lib/docx/docxStage.ts`,
`src/managers/DocxImportManager.ts`, `docs/samples/stress_test_2.docx`,
`docs/{PROGRESS,DECISIONS}.md`, and the ticket above. Cross-ref: decision row 40.

---

**2026-08-09 — Fixed nested list numbering, footnote placement and the
first-page header in Word conversion; diagnosed a fourth defect as third-party
(offline, code + a purpose-written fixture). ✅ DONE.** Wrote
`docs/samples/stress_test_2.docx` by hand — raw OOXML rather than python-docx —
carrying the eight constructs a generated fixture had silently dropped, and
verified all eight present in its XML before testing. It found four defects on
first run; three are fixed. **(1) Nested counters:** docx-preview restarts a
sublevel with `counter-set` on the *element*, while `counter-increment` sits on
the `::before`; the resolver read only the pseudo-element and only
`counter-reset`, so a list numbered 1., 1.1., 1.2., 2., **2.3.**, 2.4. Now
1., 1.1., 1.1.1., 1.1.2., 1.2., 2., **2.1.**, 2.2., 3. **(2) Footnotes:** the
`<ol>` docx-preview emits after the article was never staged, so marks rendered
and note text did not. Notes are now matched to pages via the reference mark's
1-based position in that list, and the band shrinks by their measured height —
`settleBand` resolves the circularity in at most two passes. **(3) First-page
header:** with `titlePg`, docx-preview renders only the first-page header, so
repeating it stamped "DRAFT" on every page; the package is now re-rendered once
with the flag stripped, purely to harvest each section's default header, and
only when the flag is actually present. **Proof:** `npx tsc -b` exits 0,
`npm run build` green, `npm run lint` unchanged at 4. Page 1 shows the
first-page header, page 2 the default; footnotes 1–2 sit at the foot of page 1
and footnote 3 at the foot of page 2, none overlapping body text. All seven
documents hold their page counts — `letter` 2, `termination` 1, `litivest` 4,
`hf` 1, `hf-long` 3, `stress_test` 13, `stress_test_2` 3. **(4) Not fixed, and
not ours:** a two-column section captures with text drawn over itself. The
section is a single band, and a screenshot of the live DOM shows two clean
columns while the captured copy overlaps — so the fault is in `@zumer/snapdom`.
A height/`column-fill` workaround was tried, did not help, and was reverted;
filed as `docs/tickets/snapdom-duplicates-text-in-multi-column-sections.md`.
**Files:** added `src/lib/docx/{docxFootnotes,docxTitlePage}.ts`,
`docs/samples/stress_test_2.docx`, the ticket above; edited
`src/lib/docx/{docxMarkers,docxRender,docxStage,docxPaginate}.ts`,
`src/managers/DocxImportManager.ts`, `docs/{PROGRESS,DECISIONS}.md`.
Cross-ref: decision row 39.

---

**2026-08-09 — Rebuilt Word page windowing as a paint-only operation and fixed
silent text loss at band edges; confirmed two remaining gaps with a purpose-built
stress fixture. ✅ DONE.** A generated fixture (`docs/samples/stress_test.docx`:
three sections, a landscape section, real `PAGE`/`NUMPAGES` fields, a
`tblHeader` table, merged cells, an inline image, a hyperlink, Hebrew) converted
to **15 pages** for a ~7-page document. Root cause: staging moved the flowed
element and set `position: absolute`, stopping child-margin collapsing and
inflating one section's flow from **2,908px to 4,752px**. Windowing now uses
`transform` + `clip-path` on the untouched element — paint-only, so it cannot
reflow — and geometry is measured from the pristine render again. Separately,
runs are now assigned to the band holding their **midpoint** instead of
requiring full containment: a heading line box at `y = -4` had put the whole
title page above the first band, dropping all four words of the document title
from the text layer while rendering perfectly. **Proof:** 15 → 13 pages with the
inflation gone; title page text layer 0 words → full title; the Hebrew proposal
held 5,345 → 5,333 extracted characters (no text lost — the word-count delta is
RTL tokenisation noise from tighter spacing); all six documents held their page
counts — `letter` 2, `termination` 1, `litivest` 4, `hf` 1, `hf-long` 3,
`stress_test` 13, and portrait→landscape section changes verified as
612×792 → 792×612 within one document. `npx tsc -b` exits 0, `npm run build`
green, `npm run lint` unchanged at 4. **Confirmed but not fixed**, now filed in
`docs/tickets/word-fields-and-repeating-table-headers-are-not-rendered.md`:
`PAGE`/`NUMPAGES` fields render as *nothing* (`Page  of `) because docx-preview
does not evaluate fields — worse than the predicted "same number every page";
and `tblHeader` rows do not repeat, verified by reading the top line of the three
pages the wide table spans (`Col 1 Col 2`, then `R16C0`, then `R32C0`). **Still
untested** because the fixture lacks them: footnotes, real multi-level `numPr`
lists, text boxes, anchored/wrapped images, and `<w:rtl/>` runs. **Files:**
`src/lib/docx/docxStage.ts`, `src/managers/DocxImportManager.ts`,
`docs/samples/stress_test.docx`, `docs/{PROGRESS,DECISIONS}.md`, and added
`docs/tickets/word-fields-and-repeating-table-headers-are-not-rendered.md`.
Cross-ref: decision row 38, correcting rows 35 and 37.

---

**2026-08-07 — Word headers now render and repeat per page, and page-break
geometry moved into the flowed element's own space (offline, bug fixes +
browser QA on five documents). ✅ DONE.** Prompted by a header/footer template
the user supplied to test exactly this. Two bugs, one visible and one subtle.
`splitPageParts` recognised only `ARTICLE` and `FOOTER`, so the `HEADER` a
rendered page carries as its third child was never staged — every converted page
lost its header entirely. Headers now clone onto each page like footers, keeping
their measured offset (fixed within the top margin on every page) while the
footer stays pinned to `pageHeight - marginBottom`, because its measured offset
is the foot of the document rather than of a page. Second: bands were computed
from geometry measured **before** the flowed element was staged, and moving it
changes margin collapsing, so every break sat a few pixels off the gap it was
chosen to fall in and shaved a sliver of the previous line onto the next page.
All pagination geometry is now measured after staging, in the flowed element's
own space. **Proof:** `npx tsc -b` exits 0; `npm run build` green; `npm run lint`
unchanged at the same 4 pre-existing warnings. Browser QA on five documents —
`letter.docx` 2 A4 pages, `termination.docx` 1 page with its signature intact,
`litivest.docx` 4 Letter pages, `Document_with_Header_Footer.docx` 1 page with
header and footer both rendered, and a six-times-repeated variant of it 3 pages
with header **and** footer present on every page. The offending page went from a
half-clipped line at its top to a clean paragraph start, and the Hebrew proposal
recovered words at its breaks: **1,040 → 1,047** of 1,051, so the straddling-word
gap fell from ~1% to ~0.4% and its ticket's figures are corrected. Two wrong
diagnoses were tried first and are recorded in decision row 37 so they are not
retried: padding unbreakable boxes for glyph ink (kept — independently correct,
but not the cause) and awaiting a frame after `show()` (removed — the capture was
never racing; it was rendering correct pixels for incorrect bands). **Files:**
`src/lib/docx/{docxPaginate,docxRender,docxStage,docxTextLayer}.ts`,
`src/managers/DocxImportManager.ts`,
`docs/tickets/word-conversion-text-layer-has-three-gaps.md`,
`docs/{PROGRESS,DECISIONS}.md`. Cross-ref: decision row 37, refining row 35.
**Newly known gap:** a footer containing a real `PAGE` field would show the same
number on every page, because one rendered footer is cloned; the test template
uses literal text so this was not exercised. Not committed at time of writing.

---

**2026-08-07 — Added on-device Word (.docx) to PDF conversion with app-side
pagination, and collapsed the four per-format add buttons into one picker
(offline, code + discovery surfaces + browser QA on two real documents).
✅ DONE.** A `.docx` now renders through `docx-preview`, is paginated by the app,
captured per page with `@zumer/snapdom`, and written into a PDF with an invisible
DOM-derived text layer over each raster, so converted pages still select and
search. Styles, headings, lists, tables, images, headers, footers and
right-to-left text survive. Carlito and Caladea are bundled as metric-compatible
substitutes for Calibri and Cambria so lines wrap where Word wrapped them. The
empty state and toolbar now offer one **Add files** picker plus **Start blank**,
with four coloured file-type badges naming the supported formats. **Proof:**
`npx tsc -b` exits 0; `npm run build` green (entry chunk 1,447 → 1,453 kB — the
two libraries are lazy-loaded); `npm run lint` unchanged at the same 4
pre-existing warnings; all **9** FAQ answers verified word-for-word identical
between the JSON-LD and the visible block in built `dist/index.html`; agent card
(v2.3.0, 10 skills, 7 input modes) and sitemap parse. Browser QA drove three
documents through `agent-browser`: the synthetic `letter.docx` → 2 A4 pages with
bullets clean and the numbered list correctly reading `1.` then `2.`; a **real
signed contract** → 1 A4 page, signature at its declared 199×128px in the signing
block; a **real 4-page Hebrew proposal** → 4 pages at 612×792 Letter (from a
single 2517pt page before pagination), 1,040 words extractable, RTL tables with
shaded headers, footer repeated on every page. Regression: the earlier documents
still produce 2 and 1 pages respectively. **Five bugs found and fixed during QA,
three of them only visible on the real files:** (1) words ran together in the
text layer because the invisible font was sized from box height, not width, so
Liberation Sans overlapped the next word — now fitted to the measured box;
(2) a word straddling a soft line break was emitted once per client rect,
writing its whole text several times (`margin, margin, margin,`) — caught by
counting draw operations, 69 runs vs 71 ops on one page, now one word per entry;
(3) `renderAsync` resolves before its blob-URL images decode, so a 501 kB
signature was measured and captured at 0×0 — images are now awaited;
(4) Tailwind preflight's `img { max-width: 100% }` reached into the render host
and, because a floating `wp:anchor` image lives in a **zero-size** wrapper,
collapsed the contract's signature to `0px` wide (`0x128` → `199x128` after the
fix), and the override had to move to `document.head` because `renderAsync`
empties its own container; (5) list markers lost their CSS counters and leaked a
literal `\9` through the capture, because `counter-increment` is declared on the
`::before` — markers are now resolved and pinned back onto the same
pseudo-element. **Files:** added
`src/lib/docx/{docxRender,docxFonts,docxRasterize,docxTextLayer,docxPaginate,docxStage,docxMarkers}.ts`,
`src/managers/DocxImportManager.ts`,
`src/components/{SupportedFormats,FileTypeBadge}.tsx`, `public/fonts/docx/*`
(Carlito, Caladea, OFL, README); edited
`src/coordinator/PdfToolkitCoordinator.tsx`, `src/lib/fileAccept.ts`,
`src/components/{EmptyState,Toolbar}.tsx`, `package.json`, `package-lock.json`,
`index.html`, `README.md`,
`public/{llms.txt,llms-full.txt,index.md,sitemap.xml,.well-known/agent-card.json}`,
`docs/{PROGRESS,DECISIONS}.md`; added
`docs/tickets/{word-conversion-text-layer-has-three-gaps,pdfjs-dist-has-a-high-severity-advisory-not-reachable-in-this-app}.md`.
`package.json` and `package-lock.json` move from `0.0.0` to `1.1.0`, closing the
manifest-versus-tag drift that decision row 34 recorded as unresolved at
`v1.0.0`; the bump rides in this commit so the tagged tree and its tag agree.
Cross-ref: decision rows 34, 35 and 36. **Known gaps, filed not hidden:** list
markers, headers/footers and words split across a page break are visible but not
selectable (~1% of words). Not deployed, so the discovery surfaces remain
unverified live and must be re-probed after the next deploy per rows 13 and 22.

---

**2026-08-07 — Released the spreadsheet-import work as `v1.0.0`, the project's
first version tag (commit only; not pushed). ✅ DONE.** The two units below —
on-device CSV/TSV/Excel import (2026-08-06) and right-to-left worksheet handling
(2026-08-07) — are committed together on `main` with the devlog and all four new
tickets in the same commit, and marked with an annotated tag `v1.0.0`. Those two
entries each close with "Not committed or deployed (not requested)", which was
true when written; this entry supersedes that status rather than rewriting them.
The tag naming convention (lowercase `v`, semver, annotated) is decision row 34,
including the deliberate note that `package.json` still reads `"version":
"0.0.0"` and that the drift is unresolved. **Proof:** every path in
`git status --short` enumerated and checked against `git diff` before committing
— 12 modified, 14 added, no incidental edits, and the stray tracked `--full-page`
file confirmed absent from the diff after being restored yesterday;
`npx tsc -b` exits 0, `npm run build` green, `npm run lint` unchanged at the same
4 pre-existing warnings. **Not pushed**, as requested, so `origin` still points at
`97ed1bf` and nothing is deployed — the discovery surfaces in this release remain
unverified live and must be re-probed after the first deploy, as decision rows 13
and 22 require. Cross-ref: decision rows 32, 33, 34.

---

**2026-08-07 — Right-to-left worksheets are now detected and mirrored; a Hebrew
workbook no longer converts as left-to-right (offline, bug fix + discovery
surfaces + browser QA). ✅ DONE.** Reported by the user against a real Hebrew
`.xlsx`: it converted with column A on the left, the mirror image of what Excel
shows. Root cause: `readWorksheet` read only `<row>` elements and never opened
`sheetViews`, so the sheet's own `rightToLeft` declaration was invisible to the
importer — `grep -rn "rightToLeft" src/` returned 0 hits. Direction is now read
from `sheetView/@rightToLeft` and obeyed absolutely when present (either value);
when the attribute is **absent** — its schema default is false, so an LTR sheet
omits it, and CSV has no metadata at all — direction is inferred from the text,
requiring a strict majority of strongly-directional cells. An RTL sheet has its
columns reversed once, up front, so measurement, wrapping and wide-sheet column
grouping stay direction-agnostic and the first group starts at the rightmost
columns; the table block and its caption then hang off the right margin.
Per-cell alignment was deliberately **not** flipped: Microsoft documents General
alignment as content-driven "regardless of worksheet direction", which is what
the renderer already did. **Proof:** `npx tsc -b` exits 0; `npm run build` green,
entry chunk 1,440,640 → 1,441,300 bytes (+660 bytes); `npm run lint` unchanged at
the same 4 pre-existing warnings; the 8 FAQ answers still word-for-word identical
in built `dist/index.html`; agent-card (v2.2.1) and sitemap parse, all surfaces
re-verified to 2026-08-07. Browser QA drove a four-way fixture
(`scratchpad/rtl.py` → `hebrew.xlsx` with three sheets declaring `rightToLeft=1`,
`rightToLeft=0` and no flag, plus a Hebrew `hebrew.csv`) and measured the export
with `pdftotext -bbox` on a 595pt-wide page: `rightToLeft="1"` → ink x 451–559
(right margin); `rightToLeft="0"` with Hebrew content → x 36–157 (left margin —
the explicit flag beats the heuristic); flag absent with Hebrew content → x
451–559 (inferred RTL); Hebrew CSV → x 493–559 (inferred RTL). Rendered page 1
confirms `אזור` (column A) rightmost, `מוצר`, then `כמות`, with the caption
`מכירות` bottom-right. Regression check: `report.xlsx`, which holds one Hebrew
cell among many English ones, still renders LTR (ink from x 36) with that cell
still right-aligned inside its column, so the majority rule does not flip mixed
tables. **Files:** `src/lib/sheets/sheetTable.ts`,
`src/lib/sheets/xlsx/xlsxReader.ts`, `src/lib/sheets/csvParser.ts`,
`src/lib/sheets/tableRenderer.ts`, `src/managers/SheetImportManager.ts`,
`index.html`, `public/{llms.txt,llms-full.txt,index.md,sitemap.xml,.well-known/agent-card.json}`,
`docs/{PROGRESS,DECISIONS}.md`. Cross-ref: decision row 33, refining row 32. Not
committed or deployed (not requested), so the surfaces remain unverified live.

---

**2026-08-06 — Added on-device CSV/TSV/Excel import: spreadsheets convert to
PDF pages of real vector text and merge into the working document (offline,
code + discovery surfaces + browser QA). ✅ DONE.** Opening a `.csv`, `.tsv`,
`.xlsx` or `.xlsm` file now converts it to PDF **in the browser** and hands the
bytes to the existing `PdfSourceManager`, so its pages behave as ordinary PDF
pages everywhere downstream. Each worksheet becomes a paginated table drawn with
pdf-lib and the bundled Liberation Sans: heading row filled and repeated on every
page, numbers and dates right-aligned with headings following their column,
Hebrew cells laid out through the existing bidi run splitter, portrait or
landscape chosen per worksheet by the table's own width, and a sheet too wide for
the paper continued across further pages with a `columns N of M` caption. Hidden
worksheets are skipped; the first 10,000 rows and 256 columns are kept and the
cap is stated on the page. **No new dependency** — the .xlsx reader is ~450 lines
over `fflate` (already used by split-to-ZIP) and the platform `DOMParser`; CSV is
parsed in-app with delimiter sniffing. **Proof:** `npx tsc -b` exits 0;
`npm run build` green, entry chunk 1,425,196 → 1,440,640 bytes (+15 kB raw,
+5 kB gzip, zero new packages); `npm run lint` unchanged at the same 4
pre-existing warnings. Browser QA via `agent-browser` against `npm run dev` with
hand-built OPC fixtures (`scratchpad/make_fixtures.py`, copied to
`~/Downloads/fpm-qa/`): `report.xlsx` → 2 pages, `budget.csv` → 1,
`semicolon.csv` → 1, `wide.xlsx` → 3, exported as one 7-page 56,733-byte PDF
whose text `pdftotext` recovers in full. Verified in that output — shared
strings, inline strings and formula results; serial `43831` → `2020-01-01` and
serial `59` → `1900-02-28` (both branches of the Lotus leap-year bug);
`numFmtId="4"` with no `formatCode` → `1,234,567.89` and `-2,500.00`; custom
`0.0%` → `12.3%`; `numFmtId="22"` → `2022-01-01 12:00:00`; booleans → `TRUE`/
`FALSE`; `#DIV/0!` preserved; `0.30000000000000004` → `0.3`; a sparse row with no
`B3` keeping `C3` in column C; an absent row 5 left blank; the hidden sheet's
canary string appearing **0** times; a semicolon-delimited European CSV sniffed
correctly so `1,50` stayed one cell; a CSV field with an embedded comma, an
embedded newline and an escaped quote all intact; `wide.xlsx`'s 40 columns split
18/18/4 with captions `Wide · columns 1..3 of 3`. A 10,500-row CSV produced 271
pages ending at row 9999 with `big · first 10,000 rows shown`. `legacy.xls` was
rejected with `"legacy.xls" is the older binary Excel format, which can't be read
in the browser. Re-save it as .xlsx or .csv and try again.` A converted page was
then rotated 90°, given a text annotation and exported: the result carries
`/Rotate 90`, the annotation, and the intact table on one page — confirming
converted pages need no special handling anywhere. Mobile checked at 390×844:
all four empty-state buttons visible, no horizontal overflow
(`scrollWidth` 375 ≤ 390), one `<h1>`, 8 FAQ entries, 13 feature entries.
Discovery surfaces moved in the same unit: descriptions, `featureList`,
`fileFormat`, a new "Can it convert Excel or CSV files to PDF?" FAQ and the
updated "What can it do to a PDF?" answer, with all 8 answers verified
word-for-word identical between the JSON-LD and the visible block in built
`dist/index.html`; `llms.txt`, `llms-full.txt`, `index.md` and the agent card
(new `convert-spreadsheet-to-pdf` skill, version 2.2.0) re-verified to
2026-08-06 and `sitemap.xml` bumped. **Files:** added
`src/lib/sheets/{sheetTable,csvParser,tableLayout,tableRenderer}.ts`,
`src/lib/sheets/xlsx/{zipEntries,numberFormat,workbookParts,xlsxReader}.ts`,
`src/lib/fileAccept.ts`, `src/managers/SheetImportManager.ts`; edited
`src/coordinator/PdfToolkitCoordinator.tsx`,
`src/components/{EmptyState,Toolbar}.tsx`, `index.html`, `README.md`,
`public/{llms.txt,llms-full.txt,index.md,sitemap.xml,.well-known/agent-card.json}`,
`docs/{PROGRESS,DECISIONS}.md`, and added
`docs/tickets/{word-and-powerpoint-conversion-not-implemented,spreadsheet-conversion-does-not-reproduce-workbook-formatting,spreadsheet-number-formats-use-a-bounded-subset,stray-full-page-file-committed-at-repo-root}.md`.
Cross-ref: decision row 32. **Word and PowerPoint are deliberately not built** —
the route comparison is in the first of those tickets. One incidental find: the
tracked file `./--full-page` at the repo root (a mis-flagged screenshot committed
in `9f981e7`) was overwritten by the same mistake this session and restored with
`git checkout`; its own ticket proposes deleting it. Not committed or deployed
(not requested), so the surfaces above are **not yet verified live** and need
re-probing after the next deploy as rows 13 and 22 require.

---

**2026-08-03 — Made the multi-page action row persistent and added first-class
blank pages (offline, code + discovery surfaces + browser QA). ✅ DONE.** The
bulk row now renders whenever the working document has pages, displays “Nothing
selected” in the count position, leaves Select all usable, and visibly disables
Rotate, Resize, OCR, selected export, Delete and Clear until a selection exists.
All action labels remain visible at mobile widths. “Add blank page” is available
in both the empty state and loaded-document toolbar; it appends a synthetic page
matching the document's prevailing non-image paper size, or A4 portrait when no
paper-sized page exists. Blank pages have their own source identity without
being counted as uploaded files, support the ordinary editor, annotations,
rotation, crop, resize, selection and undo/redo paths, skip needless OCR model
loading, and become real pages during PDF export. Public feature descriptions
now disclose the capability. **Proof:** `npm run build` green (448 modules;
existing >500 kB warning only); `npm run lint` green with the same four
pre-existing warnings; `git diff --check` clean; agent-card JSON and homepage
JSON-LD parse, and all seven visible FAQ answers exactly match their structured
counterparts. Browser QA created an A4 blank from the empty state, added the text
“Blank page works,” and extracted that text from a one-page exported PDF; adding
a blank to a four-page 612×792 fixture produced “5 pages · 1 file · 1 blank
page,” a five-page export whose last page was also 612×792, and Undo/Redo changed
the document 5→4→5. At 390px all eight bulk labels remained visible, empty-state
actions were disabled as intended, and document width did not overflow.
Screenshots and exported QA PDFs are under `/private/tmp/pdf-toolkit-qa/`.
**Files:** `src/domain/types.ts`, `src/lib/pageSizing.ts`,
`src/coordinator/{toolkitContext,PdfToolkitCoordinator}.tsx`,
`src/managers/{PdfExportManager,OcrManager}.ts`,
`src/hooks/usePagePreview.ts`,
`src/components/{AppHeader,BulkActionBar,EmptyState,PageThumbnail,ResizeMenu,SourceLegend,Toolbar}.tsx`,
`README.md`, `index.html`,
`public/{index.md,llms.txt,llms-full.txt,.well-known/agent-card.json}`,
`docs/{PROGRESS,DECISIONS}.md`, and
`docs/tickets/{blank-page-creation-is-missing,ocr-action-is-hidden-until-a-page-is-selected}.md`.
Cross-ref: decision row 31; both named tickets closed. Not committed or deployed
(not requested).

---

**2026-08-03 — Audited the reported missing controls and separated one absent
feature from three environment/discoverability behaviors (diagnosis + tickets;
no application code). ✅ DONE.** Blank-page creation is genuinely unimplemented:
repository search returned no operation or control and the loaded-document
toolbar exposed none, so `blank-page-creation-is-missing.md` records the expected
feature gap. Metrics are healthy in production: the live `/api/usage` returned
200 JSON with totals (including 762 pages removed and 204 files added), and
browser measurement found “The machine so far” within the initial viewport;
plain Vite dev intentionally receives HTML from `/api/usage`, fails the JSON
read and reserves blank space instead. OCR is selection-scoped: it was absent
after a four-page fixture loaded and appeared as “OCR locally” immediately after
selecting page one; its discoverability gap is now
`ocr-action-is-hidden-until-a-page-is-selected.md`. PWA behavior is likewise
production-only: dev had a manifest but no registration, while the production
preview reported an active controller/registration and current cache
`free-pdf-machine-2026-08-03-3`; the old implementation ticket is closed and the
lack of an in-app install affordance continues in
`pwa-install-affordance-is-not-visible.md`. The production preview was left
running at `127.0.0.1:4173` for user testing. **Files:** added the three tickets
above; updated `docs/tickets/no-pwa-manifest-or-offline-support.md` and
`docs/PROGRESS.md`. No build/lint run because this turn changed documentation
only; the preceding code unit's green proof remains unchanged.

---

**2026-08-03 — Centered every new feature/feedback popup in the viewport and
kept long dialogs internally scrollable instead of clipped (offline, shared UI
fix + browser QA). ✅ DONE.** The shared `Modal` already used flex centering, but
it was mounted below `AppHeader`; that sticky header's `backdrop-filter` created
a containing block for `position: fixed`, so the overlay was fixed to the short
header area rather than the viewport and appeared at the top/cropped. `Modal`
now portals its overlay to `document.body` and gives the viewport overlay
vertical overflow handling, while the panel retains its `90dvh` maximum and
internal scroll. Smart Split, Page Numbers & Watermark, Crop, Forms and Feedback
all consume this one component, so one change covers all five. **Proof:** `npm
run build` green; `npm run lint` green with the same four pre-existing warnings.
`agent-browser` measured the feedback dialog at 1440×900 with vertical center
delta exactly `0px` and `parent=BODY`; at a deliberately short 390×500 viewport
it measured `top=25`, `bottom=475`, `height=450`, center delta `0px`, fully
visible `true`, and internal scrolling `true`. Screenshots:
`/private/tmp/pdf-toolkit-qa/screenshots/modal-centered-{desktop,mobile}.png`.
**Files:** `src/components/ui/Modal.tsx`, `docs/PROGRESS.md`. No decision row:
this restores the already-intended centering behavior rather than establishing a
new product choice. Not committed or deployed (not requested).

---

**2026-08-03 — Shipped the seven requested PDF workflows—smart split, document
undo/redo, batch page numbers/watermarks, crop, installable offline PWA,
AcroForm filling, and on-device OCR—plus a Netlify Forms feedback dialog; synced
the complete public spec (offline, code + docs). ✅ DONE.** Page mutations now
keep 100 undo/redo snapshots and source handles survive until Reset; the split
parser accepts comma groups, `end`, reverse ranges, odd/even and selected pages,
then emits one extracted PDF or one PDF per group in a ZIP. Export-only stamps
add page numbers and an opacity-controlled watermark; percentage margins become
real PDF CropBoxes without rasterizing. Supported standard AcroForm controls are
read locally, applied to pristine source clones, given embedded-font appearances
and flattened before page copy. Tesseract.js lazily performs sequential English
OCR on selected pages and exports invisible word-positioned searchable text.
The PWA precaches Vite's hashed graph, fonts and pdf.js decoders; an offline QA
failure caused by `Vary: Origin` was found, documented, fixed with same-origin
`ignoreVary` matching, and re-tested server-off. The Feedback button uses a
React dialog over a hidden build-time Netlify form declaration and POSTs only
the category, message and optional email the user deliberately submits. Public
privacy copy now states that exception while continuing to guarantee that no
document content is sent. **Proof:** `npm run build` green (447 modules; OCR
split into lazy 8.76/17.24 kB chunks; existing >500 kB bundle warning remains);
`npm run lint` green with the same four pre-existing warnings; `npm audit
--omit=dev` reports 0 vulnerabilities after non-breaking transitive fixes;
`git diff --check` clean; agent-card JSON and homepage JSON-LD parse; a scripted
check confirms all seven visible FAQ answers exactly match JSON-LD. Browser QA
on a generated four-page PDF verified delete/Undo/Redo state counts, range error
handling, a two-entry split ZIP, three detected/form-filled field kinds, 5% crop,
watermark and `Page N of 4` on all pages, flattened forms (zero fields), and
searchable OCR text. A stopped production server then reloaded the full cached
editor; mobile 390×844 had no horizontal overflow and the feedback control has
an accessible name. The feedback submission was intercepted as a URL-encoded
POST to `/` returning 200 and showed “Thanks—your feedback was sent.” Temporary
QA evidence lives under `/private/tmp/pdf-toolkit-qa/`, including the resolved
dogfood report and screenshots. **Files:** added
`public/{manifest.webmanifest,service-worker.js}`,
`src/components/feedback/FeedbackDialog.tsx`,
`src/components/tools/{SmartSplitDialog,DecorationsDialog,CropDialog,FormFillingDialog}.tsx`,
`src/components/ui/Modal.tsx`,
`src/lib/{pageRanges,cropGeometry,exportDecorationDefaults,exportDecorations}.ts`,
and `src/managers/OcrManager.ts`; edited `README.md`, `index.html`,
`netlify.toml`, `package.json`, `package-lock.json`,
`public/{index.md,llms.txt,llms-full.txt,sitemap.xml,.well-known/agent-card.json}`,
`vite.config.ts`, `src/main.tsx`,
`src/domain/types.ts`, `src/lib/download.ts`,
`src/coordinator/toolkitContext.ts`, `src/coordinator/PdfToolkitCoordinator.tsx`,
`src/managers/{PageListManager,PdfExportManager,PdfSourceManager}.ts`,
`src/managers/annotation/TextStamper.ts`,
`src/components/{AppHeader,BulkActionBar,PageThumbnail,Toolbar}.tsx`,
`src/components/annotations/{AnnotationOverlay,PreviewSurface}.tsx`, and
`docs/{PROGRESS,DECISIONS}.md`. Cross-refs: decision rows 28–30. Not committed
or deployed (not requested).

---

**2026-08-03 — Ported and enabled the existing Devlog workflow for Codex while
sharing the repository's current history (personal plugin + repo wiring; docs
only, no code change). ✅ DONE.** Identified the Claude integration as the local
`devlog` plugin, ported its five disciplines (`init`, `progress-log`,
`decision-log`, `tickets`, and `session-wrap`) to Codex conventions, installed
and enabled it from the personal marketplace, and added `AGENTS.md` so Codex
reads the same `docs/PROGRESS.md`, `docs/DECISIONS.md`, and `docs/tickets/`
artifacts rather than creating parallel state. The port replaces Claude-only
references with Codex/`AGENTS.md` equivalents while preserving the file formats
and evidence rules. **Proof:** all five official skill validations returned
`Skill is valid!`; the official plugin validator passed both the staged and
installed source; `codex plugin list` reports `devlog@personal` as `installed,
enabled` at version `0.1.0`. No application tests were run because this changed
only personal Codex configuration and repository documentation. **Repository
files:** added `AGENTS.md`; updated `docs/PROGRESS.md` and
`docs/DECISIONS.md`. Cross-ref: decision row 27.

---

**2026-08-02 — Added completed Daily and Weekly usage views backed by immutable
UTC snapshots (offline, code + docs). ✅ DONE.** The lifetime `totals` blob and
compare-and-swap increment path remain unchanged. A new scheduled function runs
at `0 0 * * *`, reads the cumulative totals, and freezes the first capture under
`snapshots/YYYY-MM-DD` with `onlyIfNew`; this makes retries idempotent without
moving a day's boundary. `/api/usage/history` lists the latest 32 captures,
oldest-first, behind the same 15-minute CDN policy as lifetime totals. The client
fetches both endpoints together and offers All time / Daily / Weekly controls in
the existing panel. Daily is the difference between exact adjacent UTC dates;
Weekly uses an exact seven-day boundary. Missing boundaries disable the period
instead of silently merging days, and old lifetime totals are explicitly not
backfilled. The loading skeleton and hidden reservation grew with the selector,
keeping the panel footprint stable. **Proof:** `npx tsc -p
tsconfig.netlify.json`, `npm run build`, and `npm run lint` green (lint retains
the same four pre-existing warnings); standalone compiled arithmetic harness
verified daily `15−12=3`, weekly `15−2=13`, `Aug 2 UTC` labeling, and a null
Daily period when Aug 2's boundary was removed; the delayed local preview at
`127.0.0.1:5173` returned the mocked lifetime payload and three ordered snapshot
payloads used by all three selector states. **Files:** added
`netlify/functions/{snapshot-usage.ts,usage-history.ts}` and
`src/analytics/usagePeriods.ts`; edited `netlify/lib/usageStore.ts`,
`netlify.toml`, `src/analytics/eventNames.ts`, `src/hooks/useUsageCounters.ts`,
`src/components/usage/UsageCounters.tsx`, `src/landing.css`, `README.md`,
`docs/DECISIONS.md`, and closed
`docs/tickets/usage-counters-arrive-late-and-shift-layout.md`. Cross-ref: decision
row 26.

---

**2026-08-02 — Made the app shell full-bleed so a bigger window actually gives a
bigger page: the 1400px cap is gone from `<main>`, the header, and the boot
state (offline, code + docs). ✅ DONE.** Follow-up to the entry below, from the
user reporting that enlarging the browser window did not stretch the page.
**Diagnosed before changing anything:** the editing dialog was fine — with it
open, a live resize from 1200×800 to 2000×1300 grew its page canvas 386×547 →
740×1047 and its margins stayed exactly 25px, so the flex chain reflows as
intended. The regular view was the problem: `<main>` measured **1400px wide
inside a 2000px window, with 293px and 308px of dead gutter**, because of a
`max-w-[1400px]` that is invisible on a ≤1400px laptop screen and only shows up
on a larger display. Removed it from the three places that must agree —
`<main>` in `PdfToolkitView`, the header's inner container in `AppHeader`, and
`.app-boot-box` in `src/landing.css` (the placeholder React replaces on mount;
a width mismatch there would resize the dashed box at mount, the shift rows 15
and 16 guard against). **Proof:** `<main>` and the header both now measure
`left=0, width=1985` at a 2000px viewport, and the grid's fixed column counts
turn that into visibly larger thumbnails; the editor still measures
top/left/bottom 25px with a 740×1047 page; at 390px `document.body.scrollWidth`
equals the viewport width, so nothing overflows and the mobile layout is
unchanged. `npm run build` green, `npm run lint` unchanged at 4 pre-existing
warnings. Screenshots at 2000×1300 (grid, editor) and 390×844 taken with
`agent-browser` against `npm run dev`. **Files:**
`src/components/PdfToolkitView.tsx`, `src/components/AppHeader.tsx`,
`src/landing.css`. Cross-refs: decision row 25; extends row 24. Not committed
(not requested).

---

**2026-08-02 — Placed text boxes are now editable (pencil on the mark and on
its items-list row), and the editing dialog sizes to the viewport at 25px from
every edge with the page area flex-filling it (offline, code + docs). ✅ DONE.**
Three user asks in one unit: an edit button on the text box element, the same
edit on the left sidebar, and a dynamic editor view "25px from all sides" so
big screens get a big page worth zooming. Editing reuses the creation editor: a
session-scoped `editingTextMarkId` in `PageEditorModal` swaps the active tool
for a new `TextEditTool`, which hides the mark from `ExistingMarksOverlay`
(new `hiddenMarkId` prop), brings its text up prefilled in `TextEditLayer` at
the mark's displayed position (clamped down to `TEXT_CLICK_BOX` so shortened
text shrink-fits), and saves through the coordinator's new
`updateTextAnnotation` — re-basing `rotationAtCreate` to the current page
rotation, so text edited on a since-rotated page saves upright at the same
spot (decision row 23). The pencil reaches both entry points through
`markSelectionContext` as a nullable `editTextMark`, so grid thumbnails stay
inert. Escape gained a first step (cancel edit), picking any tool cancels the
edit, and starting an edit disarms the tool. Sizing: overlay `p-[25px]`,
dialog `h-full w-full` replacing `max-w-4xl`/`max-h-[94dvh]`, and the three
hard-coded `h-[65dvh]` page areas (`PreviewSurface`, `SignatureDrawStep`,
`ImagePickStep`) became `min-h-0 flex-1` (row 24). **Proof:** `tsc -b` +
`vite build` green; `npm run lint` unchanged at 4 pre-existing warnings.
Driven end-to-end with `agent-browser` against `npm run dev`: text box placed
and saved; on-page pencil reopened it prefilled with caret at end (verified
`selectionStart` 11, `activeElement` the textarea), appended text saved and
the list row title followed ("Text: Hello world edited"); sidebar pencil
opened the same editor; typed junk then Escape left the mark untouched with
the session still open; page rotated 90° in the grid, its rotated mark edited
— textarea came up horizontal and the save landed upright at the mark's spot;
dialog gaps measured exactly top/left/bottom 25px at both 1600×1000 and
1100×760 (right 25px + document scrollbar), zoom to 150% scrolling within the
enlarged area. **Files:** added
`src/components/editor/tools/TextEditTool.tsx`; edited `src/domain/types.ts`
(`TextAnnotationPatch`), `src/managers/PageListManager.ts`,
`src/coordinator/{toolkitContext.ts,PdfToolkitCoordinator.tsx}`,
`src/components/annotations/{markSelectionContext.ts,MarkControls.tsx,AnnotationOverlay.tsx,ExistingMarksOverlay.tsx,PreviewSurface.tsx}`,
`src/components/editor/{MarksListPanel.tsx,PageEditorModal.tsx}`,
`src/components/editor/tools/TextTool.tsx`,
`src/components/text/TextEditLayer.tsx` (caret-to-end on focus),
`src/lib/annotationStyles.ts` (`TEXT_CLICK_BOX` moved here for fast refresh),
`src/components/signature/SignatureDrawStep.tsx`,
`src/components/image/ImagePickStep.tsx`. Cross-refs: decision rows 23–24;
refines the row 19 session and row 21 items list. Not committed (not
requested). The untracked `--full-page` file in the repo root predates this
session and was left alone.

---

**2026-07-29 — Deleted the SPA catch-all from `netlify.toml` and added a
self-contained `public/404.html`, so scanner probes stop being counted as
pageviews and dead URLs return a real 404. Deployed and verified live in
commit `a08f002`. ✅ DONE.** Started
from a question, not a task: the user read the Netlify report and asked what all
those pages were in a one-page app. **Answer: none of them are pages and none of
them are people.** `/wp-admin/install.php` (502 pageviews, the site's #2 "page"),
`/wp-login.php`, `/xmlrpc.php`, ten `//…/wp-includes/wlwmanifest.xml` probes
across guessed install directories, `/.env`, `/graphql`, `/netlify.toml` — all
untargeted WordPress and credential scanners, none of which apply to a static
site with no server and no PHP. The part that *was* ours: they showed up under
**Top pages** rather than **Top resources not found** because the `/*` →
`/index.html` rewrite answered every one of them **200 with the app shell**. So
roughly a third of the reported traffic was fictional and the true `/` figure was
unknowable — which matters because row 17 makes traffic the metric the whole
monetization plan is deferred against. (The handful that *did* land in
"not found" are most likely the POSTs — Netlify will not rewrite a POST to a
static file, and those paths, `/wp-login.php` at 194 and `/` at 21, are exactly
the ones a brute-forcer posts to. Stated as the best available reading of the
report, not something measured.) **The change.** The catch-all is deleted rather
than scoped: verified first that nothing in `src/` imports `react-router`, calls
`useNavigate`, or touches `history.pushState`, so it was routing nothing.
`public/404.html` is deliberately self-contained — inline CSS, inline cog SVGs,
no bundle reference — because Netlify serves it for paths that match no build
output, so it cannot depend on a content-hashed CSS filename that changes every
build. Its tokens are copied from `src/index.css` and the cog geometry is the
same lucide `cog` as `MachineMark.tsx`. **Proof:** `npm run build` green,
`dist/404.html` emitted at 7,658 bytes. Probed against `npx netlify serve` —
the real redirect engine over the real build, not the Vite dev server, which
would have answered everything 200 and proved nothing:

```
must be 200                                    now
/                                              200  text/html
/robots.txt                                    200  text/plain; charset=utf-8
/sitemap.xml                                   200  application/xml
/llms.txt                                      200  text/plain; charset=utf-8
/llms-full.txt                                 200  text/plain; charset=utf-8
/index.md                                      200  text/markdown; charset=utf-8
/.well-known/agent-card.json                   200  application/json; charset=utf-8
/favicon.svg, /og-image.png                    200  image/svg+xml, image/png

was 200, must now be 404                       now
/wp-admin/install.php  /wp-login.php           404  (7,658-byte custom page)
/xmlrpc.php  //wp/wp-includes/wlwmanifest.xml  404
/.env  /graphql  /netlify.toml                 404
/pricing  /this-page-does-not-exist-404test    404
```

`/api/usage` still rewrites to its function (200 JSON) and `/api/track` still
takes a POST (204), confirming the two rules above the deleted one are intact.
Rendered via `agent-browser` at 1280×800 and 390×844 (buttons wrap and stay
centred at mobile width), and "Open the editor" navigates to `/` where the app
mounts. One false alarm worth noting so it is not re-investigated: a mid-session
check appeared to show a *different project* ("The Eye") served at
`localhost:8899/` — that was the browser replaying a disk-cached response from
whatever last used that port; `curl` against the same URL returned this site
correctly, and a cache-busting query confirmed it. **Live proof, after pushing
`a08f002`** (the deploy landed in ~30s, and this is the verification
`CLAUDE.md` requires — the local run above does not count): against
`freepdfmachine.com`, `/` 200 `text/html`, `/robots.txt` 200
`text/plain; charset=utf-8`, `/sitemap.xml` 200 `application/xml; charset=utf-8`,
`/llms.txt` and `/llms-full.txt` 200 `text/plain; charset=utf-8`, `/index.md` 200
`text/markdown; charset=utf-8`, `/.well-known/agent-card.json` 200
`application/json; charset=utf-8`, `/favicon.svg` and `/og-image.png` 200 — so
all six discovery surfaces survived the rule's removal. `/wp-admin/install.php`,
`/wp-login.php`, `/xmlrpc.php`, `/.env`, `/graphql`, `/netlify.toml`, `/pricing`
and `/this-page-does-not-exist-404test` all **404**, serving the custom page
(grep for its `<h1>` matched). `/api/usage` still 200 JSON, and the
`pdfedittoolkit.netlify.app` → `freepdfmachine.com` 301 of row 7 still fires,
confirming the deletion did not disturb the rules around it.
**Discovery surfaces:** none touched, and that is a judgement, not
an oversight — `CLAUDE.md`'s table governs user-facing *claims* (features, file
types, privacy posture, price, name), and a 404 page changes none of them.
`sitemap.xml` is unchanged for the same reason: it lists `/`, which still exists,
and a `noindex` 404 page must never be listed. **Files:** `netlify.toml`
(catch-all removed, replaced by a comment explaining why the absence is
load-bearing), new `public/404.html`, `CLAUDE.md` (the stale "must never gain
`force = true`" rule replaced, plus a new "Adding a second page means revisiting
the routing rules" section as the user asked), `docs/DECISIONS.md`,
`docs/tickets/every-url-returns-200-soft-404.md`. **Also in this diff, from
running the Netlify CLI, not from the work:** `.gitignore` gained `.netlify`
(added by the CLI itself) and `deno.lock` (added by me — `netlify serve` writes
that file for an edge-function runtime this project does not use; the generated
file was deleted rather than committed). **Decisions:** row 22, which also
resolves open question 1. **Tickets:** closed
`docs/tickets/every-url-returns-200-soft-404.md`. **The trap this creates,**
recorded in `CLAUDE.md` and row 22: the first client-side route added to this app
will work in dev and 404 in production, because Vite's dev server still serves
index.html for any path and Netlify no longer does.

---

**2026-07-29 — The editing session now lists everything on the page down its
left side: rows select their mark (ring + scroll to it) and delete it in place
(not yet deployed). ✅ DONE.** Asked for directly: "when opening a page I want to
see a list of the items that were added to the page… also I want the option to
delete the items directly from the [list] and focus on them once selected."
Three parts. (1) **The list** — `MarksListPanel`, a 14rem column showing every
signature and annotation with a per-kind icon, the typed text as the row label
for text marks, and the mark's own colour tinting the icon for highlights. It is
collapsible from an "Items *n*" toggle at the left of the toolbar, open by
default above 768px and closed below, where it overlays the page rather than
squeezing it. (2) **Delete from the row** — a bin on every row, always visible
(hover-reveal would be invisible on a touch screen), plus Delete/Backspace on the
focused row. Deleting the selected mark clears the selection, and so does
removing it from its own corner ✕ on the page — a stale id is swept by an effect
in `PageEditorModal` rather than left dangling. (3) **Selection both ways** —
picking a row rings the mark on the page and scrolls it into view; grabbing a
mark on the page highlights its row. Escape now unwinds one step at a time:
deselect, then disarm the tool, then close. **Proof:** `npx tsc -b` exits 0;
`npm run lint` unchanged at 4 pre-existing warnings; `npm run build` green;
console clean (only Vite HMR lines). Driven end-to-end with `agent-browser` on a
generated 1-page PDF: added 2 text boxes, a text-anchored highlight, a free-hand
highlight and a drawn signature → list showed all 5 with correct labels and the
toolbar chip read "Items 5"; clicking *First note* ringed it on the page and
tinted its row; at 200% zoom, selecting an off-screen mark scrolled the preview
to it; deleting the selected *First note* from its bin dropped the count to 4,
removed it from the page and cleared the ring; clicking *Second note here* on the
page left exactly one row with `aria-current="true"`, and it was that one; two
Escapes deselected then closed. At 390×844 the panel overlays the page and starts
closed on a fresh load. **Two fixes made while building:** a highlight's remove
button used to live inside the first line rect, so it inherited
`mix-blend-multiply`; it now hangs off an anchor box over the mark's whole
bounding box, alongside the selection ring. And the row's accessible name no
longer announces "Highlight: Highlight" when the title *is* the kind's name.
**Files:** new `src/components/annotations/markSelectionContext.ts`,
`src/components/editor/MarksListPanel.tsx`, `src/components/editor/pageMarks.ts`,
`src/hooks/useMarkFocus.ts`; changed
`src/components/editor/{PageEditorModal,EditorToolbar,EditorPanel}.tsx`,
`src/components/annotations/{AnnotationOverlay,ExistingMarksOverlay,MarkControls,RectChooseStep}.tsx`,
`src/components/signature/{SignatureOverlay,SignatureDrawStep}.tsx`,
`src/components/image/ImagePickStep.tsx`, `src/hooks/useMarkTransform.ts`. The
four `flex-1` one-liners in the step components are all the same change: the tool
column has to fill the dialog row now that a sidebar sits beside it.
**Decisions:** row 21 (refines rows 19 and 20). **Tickets:** filed
`docs/tickets/highlights-cannot-be-selected-on-the-page.md` — a highlight can be
selected from the list but not by clicking it on the page, because making its
box pointer-interactive would swallow the drag the "Highlight text" tool needs.

---

**2026-07-28 — Editing-session controls reworked from user feedback: text boxes
open focused, the commit moved to a tick on the box, and every button settled on
Save/Close (UI follow-up to the session below; not yet deployed). ✅ DONE.**
Four changes, all requested after trying the session: (1) **a placed text box is
now focused**, so typing starts immediately — it was genuinely broken, and the
cause is worth knowing: the box mounts during `pointerdown` and the browser's
*default* pointerdown handling then moved focus to `<body>`, undoing the focus
call microseconds later. Fixed by `preventDefault()` on the capture surface plus
a focus effect keyed on the box position, so clicking a new spot re-focuses an
editor that is repositioned rather than remounted. (2) **The commit is now a ✓
button against the box**, not a footer button — the report was "it's unclear that
you need to click it", and a footer control is the furthest thing on screen from
the box it finishes. ⌘/Ctrl+↵ works too (plain Enter still inserts a line break,
since text annotations are multi-line). (3) **Every commit button is "Save"**,
replacing four tool-specific labels (Add text / Add highlight / Save signature /
Place image) that hid the fact they were the same act. (4) **The corner button is
"Close" and ends the session**, replacing the ambiguous per-tool "Done"; it is
safe to make it session-wide because every add already commits immediately, so
closing can never lose work, and disarming a tool still has two affordances
(click the armed tool again, or Select). **Proof:** `npx tsc -b` exits 0;
`npm run lint` unchanged at 4 pre-existing warnings; `npm run build` green;
console clean. Verified with `agent-browser`: `document.activeElement` on
placement went from `BODY` to `TEXTAREA`, and raw keystrokes with **no click into
the box** landed as "Hello"; the ✓ commits and clears the box while the tool
stays armed; ⌘↵ commits (marks 1 → 2); every footer enumerated to confirm order —
idle `[Close]`, text `[Close]`, highlight-text `[Save][Close]`, free-hand
`[…Undo, Clear][Save][Close]`, image `[Save][Close]`, sign-rect
`[Continue][Close]`, sign-draw `[Back, Undo, Clear][Save][Close]`; Close ends the
session and both annotations were still present on reopen. **Files:**
`src/components/text/TextEditLayer.tsx`, `src/hooks/useRectDrag.ts`,
`src/components/editor/tools/{Text,Highlight,Freehand,Sign,Image,Idle}Tool.tsx`,
`src/components/editor/PageEditorModal.tsx`,
`src/components/signature/SignatureDrawStep.tsx`,
`src/components/image/ImagePickStep.tsx`,
`src/components/annotations/RectChooseStep.tsx`. **Decisions:** row 20 (refines
row 19).

---

**2026-07-28 — Annotating a page became one persistent editing session instead
of one modal per action: tools, zoom, and click-to-place text all live inside a
dialog that stays open (UI rework, net −866 lines; not yet deployed). ✅ DONE.**
Triggered by a user report: "I need to reopen the page every time if I want to
add multiple text fields." They were right about the cause — the tool was picked
*before* the dialog opened, and each tool's modal closed itself on its one
successful action. The page's Edit button now opens a session with the tools as
a strip inside it; picking one arms it, finishing an action returns to the
session, and only the close button or Escape ends it. **Everything the report
asked for is in:** multiple items per session, zoom in/out while editing, a
close button, per-action Done, and click-to-place text (the box used to require
a *large* drag — a click or small drag was silently swallowed by a minimum-size
gate, which is why it "wasn't shown"). `useRectDrag` now drops a default-size
box on press and switches to drag-sizing only past a 1.2% movement threshold, so
both gestures work. Saving-after-every-action needed no change and is now simply
visible: the coordinator always applied each add immediately, but the modal
closing hid that fact. The idle state (no tool armed) has no capture layer over
the page, so placed marks are directly draggable — which made the separate "Move
& resize" dialog redundant, and it was deleted rather than ported. **A memory
hazard was caught mid-build and fixed:** multiplying the render target by zoom
would have allocated ~130 MB bitmaps at 4×, so `usePagePreview` now takes the
intended on-screen width rather than a zoom factor, which also cut the *unzoomed*
preview from ~32 MB to 9.6 MB — the old fixed 1200 px target had been rendering
about 6× more pixels than it displayed. **Proof:** `npx tsc -b` exits 0;
`npm run lint` unchanged at 4 pre-existing warnings; `npm run build` green; 19
files changed, 161 insertions against 1,027 deletions, 10 files deleted, no
orphaned imports (grep). Driven end-to-end with `agent-browser`: two text boxes
placed by **plain clicks** plus a free-hand highlight added in **one unbroken
session** (3 removable marks, dialog never closed), then a drawn signature and a
placed image in a second session (5 marks), with the session confirmed open and
Select re-armed after each completing action; marks survived close→reopen (4
present) and reached the exported PDF, verified by rendering that PDF with macOS
PDFKit; zoom measured at Fit/150%/400% → 1396/2094/3200 px bitmaps for
417/625/1620 px boxes, i.e. exactly DPR-crisp at maximum zoom; Escape verified
two-stage; console clean throughout. One accessibility defect found and fixed in
the new code during testing: the zoom-level button's visible label ("Fit"/"150%")
was its accessible name, so its `title` was unreachable — it now carries an
explicit `aria-label`. **Not deployed.** **Files:** added
`src/components/editor/` (PageEditorModal, EditorToolbar, EditorPanel,
useEditorZoom, tools/{Idle,Text,Sign,Image,Highlight,Freehand}) and
`src/hooks/useRectDrag.ts`; deleted `AnnotateMenu`, `AnnotationModalShell`,
`ArrangeMarksModal`, `ArrangeMarksStep`, `TextAnnotateModal`,
`ImageAnnotateModal`, `HighlightAnnotateModal`, `FreehandHighlightModal`,
`SignatureModal`, `components/signature/useRectDrag.ts`; edited
`PdfToolkitCoordinator`, `toolkitContext`, `domain/types`, `PageThumbnail`,
`PdfToolkitView`, `ThumbnailGrid`, `PreviewSurface`, `RectChooseStep`,
`usePagePreview`. **Decisions:** row 19.

---

**2026-07-28 — Scanned PDFs no longer render as blank pages: pdf.js is now given
its WebAssembly image decoders (code + build plugin + one Netlify header; not yet
deployed). ✅ DONE.** Triggered by a user report that a scanned PDF "shows up
blank". Root cause: pdf.js 5+ decodes JBIG2, CCITT Group 4 and JPEG 2000 in WASM
modules it fetches at runtime from the `wasmUrl` API option, and
`PdfSourceManager.openWithPdfjs` never set it — so the three encodings scanners
actually emit could not be decoded at all. The failure was silent in the worst
way: `PDFDocument.load` succeeded, the page count was correct, the export was
already byte-perfect, and pdf.js only `warn()`ed "Dependent image isn't ready
yet" while drawing nothing. **The fix is display-only; nothing about export
changed, because nothing about export was broken.** The user's proposed
workaround — rasterise scanned pages and treat them as images — was rejected in
decision row 18 for two independent reasons: rasterising in-browser requires
rendering the page with pdf.js, the very component that was failing, and it
would turn a lossless `copyPages` into a lossy re-encode, breaking the quality
guarantee the site advertises. Delivery is a ~40-line Vite plugin
(`vite/pdfjsWasmPlugin.ts`) that serves `pdfjs-dist/wasm/` out of `node_modules`
via dev middleware and re-emits it at build under **fixed, unhashed** filenames,
because pdf.js builds these URLs by string concatenation and cannot be told a
content hash; the shared path constant lives alone in
`src/lib/pdfjsAssetPaths.ts` so the build and the runtime import the same string.
**Proof — four one-page fixtures carrying the same image in four encodings, all
four first confirmed to render identically under macOS PDFKit so the fixtures
themselves could not be blamed (`qlmanage`, mean 204.2 / stddev ≈98 for each):**
before the fix, `scan-ccitt-g4.pdf` and `scan-jpx.pdf` rendered **blank** while
`scan-jpeg.pdf` and `scan-flate.pdf` rendered correctly, with exactly two
"Dependent image isn't ready yet" warnings — one per blank page. After the fix,
**all four render**, the console is **empty**, and the network log shows
`GET /pdfjs-wasm/jbig2.wasm 200` and `GET /pdfjs-wasm/openjpeg.wasm 200`. Export
was verified unaffected rather than assumed: a 3-page mixed-encoding deck
exported from the production build contains the original CCITT, JPX and DCT
image streams **byte-for-byte verbatim** (2,645 / 140,015 / 78,498 bytes, all
`True`), and re-importing that export renders all three pages. **Confirmed against the user's real failing
document** (a 26,610-byte Israeli tax certificate, one `CCITTFaxDecode` image
XObject) rather than only against synthetic fixtures: A/B'd in the production
build by aborting `**/pdfjs-wasm/**` with `agent-browser network route` to
reproduce the pre-fix state — **blank page and one "Dependent image isn't ready
yet" warning with the decoders blocked; fully rendered form and an empty console
with them available.** Also checked and
found **not** broken, so a future session need not chase it: non-embedded
standard-14 text renders fine without `standardFontDataUrl`. `npx tsc -b` exits
0; `npm run lint` unchanged at 4 pre-existing warnings; `npm run build` green,
emitting all 13 decoder files under `dist/pdfjs-wasm/`. All browser verification
via `agent-browser` against `npm run dev` and then `vite preview`. **Not
deployed** — the live re-probe of `/pdfjs-wasm/openjpeg.wasm` happens after the
next deploy. **Files:** added `src/lib/pdfjsAssetPaths.ts`,
`vite/pdfjsWasmPlugin.ts`, `docs/tickets/pdfjs-cmapurl-unset-for-cjk-documents.md`;
edited `src/managers/PdfSourceManager.ts`, `vite.config.ts`, `tsconfig.node.json`,
`netlify.toml`. **Decisions:** row 18. **Tickets opened:**
`pdfjs-cmapurl-unset-for-cjk-documents.md` (same class of gap — `cMapUrl` is
still unset — deliberately filed rather than fixed, since unlike `wasmUrl` it is
not reproduced by any document).

---

**2026-07-23 — Static landing content added below the editor, taking the served
body from 0 to 7,375 visible characters (index.html + one new CSS file; two
small React edits; not yet deployed). ✅ DONE.** This closes the root finding of
the morning's audit. The served `<body>` was one empty `<div id="root">`, so
Googlebot needed a render pass to see anything and GPTBot, ClaudeBot,
PerplexityBot and CCBot saw literally nothing; it capped five separate audit rows
at once. `index.html` now carries a full landing section (h1, lede, an 8-item
feature grid, how the privacy claim works, how the quality guarantee works, a
"Compared with online PDF editors that upload your files" section with an honest
trade-offs card, the 7-question FAQ, and a "Who built it" block linking both
rzailabs.com pages and GitHub), followed by the site footer. **The placement is
the load-bearing decision and it changed from what the ticket proposed:** the
ticket's Option A put the block *inside* `#root`, but `createRoot(...).render()`
clears its own container's children, so that version is deleted on mount and a
person only ever sees it for one pre-hydration frame. Putting it *after* `#root`
instead means React never touches it, so the identical bytes serve crawlers and
people, it stays on the page permanently, and Google's FAQ "visible counterpart"
requirement is genuinely met rather than argued. Two consequential side effects,
both deliberate: the site `<footer>` moved out of `PdfToolkitView` into static
HTML (otherwise it would have rendered *above* the landing content in document
order; it had no props or state, so nothing was lost), and `AppHeader`'s `<h1>`
became a `<p>` (the landing block now supplies the page's real `<h1>`, and
leaving the header's would have produced two). The header subtitle also changed
from "Edit & merge PDFs in your browser" to "Free PDF editor · nothing is
uploaded" so the visible chrome carries the same free + privacy claim as every
other surface. Styles live in a new `src/landing.css` written as plain CSS
against the existing design tokens rather than Tailwind utilities, because the
markup sits outside `src/` and depending on Tailwind v4's automatic content
detection to reach `index.html` would make the whole landing page's appearance
hinge on an implicit scan path. **Proof:** `npm run build` green (`dist/index.html`
12.94 kB → 26.31 kB); `npx tsc -b` exits 0; `npm run lint` unchanged at 4
pre-existing warnings. Script diff against the built `dist/index.html` confirms
**all 7 FAQ answers are word-for-word identical** to their `acceptedAnswer.text`
strings in the JSON-LD (334/417/356/521/397/437/337 chars, 7 of 7 question and
answer matches); served body measures **7,375 visible text characters, up from
0**, with **exactly one `<h1>`** ("Free PDF editor that runs entirely in your
browser"), 6 `<h2>` and 8 `<h3>`, 4 outbound rzailabs.com links and the GitHub
link. `speakable.cssSelector` extended from `["h1"]` to
`["#about-heading", ".landing-lede"]` now that a summary element exists. Rendered
and inspected via `agent-browser` against `npm run preview` at 1280×900 (hero,
feature grid, comparison, trade-offs card, FAQ dividers, footer links all
correct; hero lede margin bumped 1.25rem → 1.5rem after the first screenshot read
tight under a 48px heading) and at 390×780 (heading wraps to three lines, claim
pills wrap to two rows, features collapse to one column). **Not deployed** — as
with the previous entry, the numbers above are from the built output, and the
live re-probe happens after the next deploy. **Projected score: 39/41 (95%), up
from 33.5/41 (82%)**, since this single change resolves A6, D1, D2, D4, D5, C4,
C2 and H1. The only two rows left open are `every-url-returns-200-soft-404.md`
and `pdfjs-bundled-into-entry-chunk.md`. **Files:** added `src/landing.css`;
edited `index.html`, `src/index.css`, `src/components/PdfToolkitView.tsx`,
`src/components/AppHeader.tsx`, `CLAUDE.md`. **Decisions:** row 14. **Tickets
closed:** `served-html-has-no-crawlable-content.md`,
`faq-markup-has-no-visible-counterpart.md`. **Note:** an untracked stray file
named `--full-page` (a blank 1280×900 PNG, an `agent-browser` flag parsed as an
output path) is sitting in the repo root and should not be committed.

[**Update, 2026-07-23 — deployed and re-probed live; the projection above is
confirmed.** `https://freepdfmachine.com/` now serves 26,315 bytes with **7,375
visible text characters** in the body (was 0), **exactly one `<h1>`** reading
"Free PDF editor that runs entirely in your browser", 6 `<h2>` and 8 `<h3>`, 4
outbound rzailabs.com links and the GitHub link. Every non-rendering agent
measured identical: GPTBot, ClaudeBot, PerplexityBot and Googlebot each receive
**7,375 visible characters** with no JavaScript executed. The live JSON-LD parses
with 4 nodes, `speakable.cssSelector` is `["#about-heading", ".landing-lede"]`
and **both selectors resolve against the served markup**, and all **7 FAQ answers
are word-for-word identical** between the `FAQPage` node and the visible page,
verified against the live response rather than the build. The discovery layer and
headers from the previous entry are unaffected: all six files still serve with
correct types, and `link`, `x-frame-options`, `x-content-type-options` and
`referrer-policy` are all still present. **Final re-audit score: 39/41 (95%)**, up
from 33.5/41 (82%) this morning and 11/40 (27.5%) at the start of the day. The two
remaining points are both open tickets and both known:
`every-url-returns-200-soft-404.md` (re-confirmed: `/nope-404-test` → `200`) and
`pdfjs-bundled-into-entry-chunk.md`. **Correction to the note above:** the stray
`--full-page` file was not caught in time and rode into commit `5854653`. It has
since been removed from the working tree, and that deletion needs its own commit
to leave the repository. This is exactly the failure the session-wrap
evidence-summary step exists to prevent, and it happened because the file was
named after a CLI flag and read as noise in `git status`.]

[**Update, 2026-07-23 — layout-shift defect in the above, reported by the user
and fixed; not yet deployed.** The user observed the landing text appearing
briefly on load and then being replaced by the app. Cause: `#root` has **zero
height** until React mounts, so on first paint the static landing section
rendered at the top of the viewport, and when the bundle finished parsing the
app claimed a full screen and shoved the landing content down by exactly one
viewport height. A visible jump and a Cumulative Layout Shift penalty, both
introduced by the previous change. Fix: `#root { min-height: 100vh }` in
`src/landing.css`, which reserves the app's space up front so the landing
content starts below the fold from the first paint and never moves. `100vh` is
used rather than `100dvh` deliberately, to match the `min-h-screen` on the app's
own root element in `PdfToolkitView`; a mismatch between the two would
reintroduce a smaller shift on mobile. **Proof:** with the bundle blocked via
`agent-browser network route "**/assets/*.js" --abort` (which reproduces the
first-paint state exactly), the first screen is now the empty reserved area and
no text appears above the fold. With the app loaded, measured
`{rootHeight: 900, landingTop: 900, viewport: 900}` at 1280×900, so the landing
section begins precisely one viewport down and nothing moves on mount. `npm run
build` green. **Related, not fixed:** the first screen is blank until the bundle
executes, measured on production at TTFB 181 ms, entry chunk 457 kB gzipped
downloading in 316 ms, DOMContentLoaded 538 ms on a fast desktop connection, and
proportionally worse on mobile. That is the pre-existing condition tracked in
`docs/tickets/pdfjs-bundled-into-entry-chunk.md`, not a regression: the site
showed a blank first screen before the landing content existed too. This change
only stops the blank period from being filled with the wrong content.]

[**Update 2, 2026-07-23 — app capped at 80vh so the landing section is
discoverable, and a static boot state added; not yet deployed.** Two further
issues the user raised after the shift fix above. **(a) "No one sees that there
is a section below."** True: with the app at `min-h-screen` the landing content
began exactly at the fold and was invisible. Both the `#root` reservation and
the app's own root element are now `80vh`, so the top of the landing block is
always on screen. Measured peek: **156px at 390×780, 140px at 1280×700, 240px at
1440×1200**. The value is bounded on both sides, and the reasoning is in decision
row 15 so a future session does not "tidy" it back to `min-h-screen`. Confirmed
no shift at all three sizes: `#root`, the app element and the landing offset are
exactly equal in every case (624/624/624, 560/560/560, 960/960/960), so the app
never outgrows its reservation. **(b) Blank first screen while the bundle
loads.** `#root` now ships a static boot state: the brand mark with its two
turning cogs, "Starting the machine", and "Loading the editor. Your files stay on
this device.", inside a dashed card that mirrors the real empty state at the same
position and size, so mounting swaps the contents of the box rather than
reshaping the page. This is the one place where markup inside `#root` is correct
rather than a bug, because `createRoot(...).render()` clearing it is exactly the
desired behaviour for a boot state. Kept dependency-free: the lucide `cog`
geometry is inlined and the rotation classes are the ones `MachineMark` already
uses, so `prefers-reduced-motion` handling is inherited. **Proof:** `npx tsc -b`
clean; `npm run build` green (`dist/index.html` 26.31 kB → 29.14 kB); `npm run
lint` unchanged at 4 pre-existing warnings. Boot state verified by blocking the
bundle with `agent-browser network route "**/assets/*.js" --abort`, which
reproduces first paint exactly: the dashed card renders with the mark and both
lines of text, and the landing heading is already visible below the divider.
Loaded state screenshotted at 1280×900 and 390×780, both correct. **Rejected the
user's suggestion of moving the text to a separate page**, with reasons in
decision row 15: the homepage is the URL that ranks, and moving the content
returns it to near-zero crawlable text. **Files:** `index.html`,
`src/landing.css`, `src/components/PdfToolkitView.tsx`. **Decisions:** row 15.
**Housekeeping:** removed the committed `--full-page` artifact (deletion still
needs a commit) and two more of the same kind, `--selector` and `-s`, both
untracked `agent-browser` screenshot artifacts from this session's flag
misparses. Three in one day means the pattern is worth watching, not just the
individual files.]

[**Update 3, 2026-07-23 — Update 2's "zero shift" was wrong on production and is
corrected here; app reverted to full viewport height and discovery moved to an
explicit link.** After deploying Update 2 (commit `0c97cc0`) and re-measuring
against **production** rather than local preview, the 80vh cap turned out to
shift the page on three of four viewport sizes: **136px at 1280x900, 296px at
1280x700, 509px at 390x780**, with peek collapsing from the claimed 140-240px to
44px and then to nothing. Only 1440x1200 behaved as reported. **Why the earlier
measurement was wrong:** it was taken against `npm run preview`, where
`/api/usage` does not exist, so `UsageCounters` never rendered and the empty
state measured 130 to 500px shorter than reality. The layout was validated
against a page missing a component, and the reported numbers were real
measurements of the wrong thing. On production the empty-state card is **747px**
and the app is **856px** desktop / **1133px** mobile, content-driven and largely
independent of viewport height, so no `vh` fraction can track it. **Fix, chosen
by the user from three options:** `#root` and the app's root element both back to
the full viewport height, so the landing sits at or below the fold before and
after mount and nothing visible moves whatever the app's real height turns out to
be; discovery handled by an explicit "How it works" link with a chevron at the
bottom of the app section, rendered identically by the boot state and by
`PdfToolkitView` from shared `.about-link-row` styles. The peek and the zero
shift are mutually exclusive, which is the substance of decision row 16. **Proof:**
boot and loaded states measured geometrically identical, `{root: 900, linkTop:
854, landingTop: 900}` in both at 1280x900, with the bundle blocked via
`agent-browser network route "**/assets/*.js" --abort` for the boot case;
screenshotted at 1280x900 and 390x780; `npx tsc -b` clean, `npm run build` green
(`dist/index.html` 29.14 kB → 29.60 kB), `npm run lint` unchanged at 4
pre-existing warnings. A `width: 100%` on `.app-boot-box` was needed and caught
by screenshot before shipping: `margin-inline: auto` opts an item out of a column
flex container's cross-axis stretch, so the boot card had collapsed to its
content width. **Known residual, not hidden:** where the app's content is taller
than the viewport (mobile), the "How it works" link is visible during boot and
below the fold once the app renders, so it moves; same class as the counters
arriving, inside the loading transition. **Verification rule this establishes:**
layout must be measured against production or with `/api/usage` stubbed, never a
bare `vite preview`. **Files:** `index.html`, `src/landing.css`,
`src/components/PdfToolkitView.tsx`. **Decisions:** row 16 (supersedes row 15's
80vh; the boot state from row 15 stands). **Tickets opened:**
`usage-counters-arrive-late-and-shift-layout.md`.]

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
