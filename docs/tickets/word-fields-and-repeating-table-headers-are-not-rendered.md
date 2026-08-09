# Converted Word pages lose repeating table header rows

Status: PARTIALLY RESOLVED · Priority: LOW · Type: missing feature · Cost: none

> **Page fields are fixed** — see decision row 40 and the progress entry of
> 2026-08-09; a footer now reads "Page 2 of 3", numbering continues across
> section boundaries, and both the well-formed and the malformed field shapes
> are handled. What remains is the repeating table header row, which is why the
> priority dropped to LOW.

## Symptom

~~**1. `PAGE` and `NUMPAGES` fields render as nothing.**~~ **Fixed.** The
converter resolves them itself, since it is the one component that knows both a
page's index and — after a first pass that paginates every section — the total.

**2. A table's repeating header row does not repeat.** A row marked
`<w:tblHeader/>` is drawn on the first page of the table only; every later page
of the same table begins with a data row and no column headings.

## Evidence

`docs/samples/stress_test.docx` carries both constructs for real:

```
$ # footer1.xml holds genuine field runs, not typed text
  word/footer1.xml: fields=['PAGE', 'NUMPAGES'] text='Page   of '
$ # and the table declares a repeating header
  tblHeader (repeat row): 1
```

Converted output (13 pages), reading the top line of the three landscape pages
the wide table spans:

```
$ for p in 6 7 8; do pdftotext -f $p -l $p v-stress_test.pdf - | head -2; done
p6: Col 1  Col 2      <- header row present
p7: R16C0  R16C1      <- header row missing
p8: R32C0  R32C1      <- header row missing
```

The rendered title page shows `Page  of ` in its footer.

## Why it matters

Repeating header rows matter on any multi-page table — a price list, a risk
register — where losing the headings makes later pages hard to read. Less
common than page numbers, and less visibly broken.

Neither affects the text layer beyond what is already recorded in
`word-conversion-text-layer-has-three-gaps.md`.

## Scope to decide

- ~~Option A — Resolve `PAGE`/`NUMPAGES` ourselves.~~ Done.
- Option B — Repeat `tblHeader` rows. Hard under the current paint-only
  staging, which slices a single rendered flow: the header row would have to be
  cloned and pinned at the top of each band that continues a table, in the
  layout rather than in the raster.
- OR Option C — Leave it; disclose non-repeating table headers on the discovery
  surfaces alongside the existing conversion caveats.

No code change made by this ticket — it is an observation on the record.
