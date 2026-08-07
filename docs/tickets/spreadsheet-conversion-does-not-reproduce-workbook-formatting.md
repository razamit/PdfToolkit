# A converted spreadsheet loses the workbook's own appearance

Status: OPEN · Priority: LOW · Type: known scope limit · Cost: none

> Deliberate scope of decision row 32, filed so the limit is tracked rather
> than rediscovered. Distinct from
> `spreadsheet-number-formats-use-a-bounded-subset.md`, which is about the
> *values* being formatted wrongly; this is about everything that is not a
> value.

## Symptom

`SheetImportManager` converts a worksheet to a table the app draws itself, with
its own palette (zinc rules, a filled header band, no vertical rules). Nothing
about how the workbook looked survives:

- cell fill colours, font families, sizes, bold/italic, borders
- merged-cell spans (a merged title renders in its top-left cell only)
- author-set column widths and row heights
- charts, images, shapes, sparklines
- conditional formatting
- freeze panes, filters, grouping
- formulas themselves — the cached result is read, the expression is not

## Evidence

The reader never looks at these parts. `readCellFormats` in
`src/lib/sheets/xlsx/workbookParts.ts` pulls only `numFmtId` out of `cellXfs`,
ignoring `fontId`, `fillId` and `borderId` in the same element, and
`xlsxReader.ts` reads no `mergeCells`, `cols`, `drawing` or `conditionalFormatting`
part at all. `sheetTable.ts` states the reason in its header comment: the cell
shape is `{ text, align }`, so a renderer could not honour anything richer even
if it were parsed.

## Why it matters

Less than it sounds, for the common case. The formats this shipped for — a CSV
export, a data table pasted into Excel, a budget — carry their meaning in the
values, and the conversion keeps those exactly while producing real selectable
text at a few kilobytes per page.

It matters for the case where the workbook *is* a designed document: an invoice
template, a formatted report, a dashboard. There the output will read as a data
dump of something that used to look like a document, and a user who expected
Excel's own "Save as PDF" will be disappointed.

Nothing in the product currently sets that expectation — the FAQ, `llms.txt`,
`llms-full.txt`, `index.md` and the landing trade-offs paragraph all state the
limit explicitly — so this is a capability gap, not a broken promise.

## Scope to decide

- Option A — Leave it. The stated scope is honest and the common case is served.
- OR Option B — Carry a narrow, high-value subset: merged-cell spans, bold on
  header rows, and cell fill colour. Each is cheap to parse and would close most
  of the visual gap on ordinary business sheets without a layout engine.
- OR Option C — Add a second, opt-in "faithful" path that renders the sheet with
  a viewer library and rasterizes it. This is Route B from
  `word-and-powerpoint-conversion-not-implemented.md`; if that route is ever
  built for DOCX, XLSX could ride the same pipeline and the user could choose
  between "values, selectable" and "looks right, raster".

No code change made by this ticket — it is an observation on the record.
