# Converted Word pages lose PAGE fields and repeating table header rows

Status: OPEN · Priority: MEDIUM · Type: missing feature · Cost: none

> Both were predicted before the fixture existed and both are now confirmed on
> `docs/samples/stress_test.docx`. Priority is MEDIUM rather than LOW because
> the first one makes a footer look *broken* rather than merely different.

## Symptom

**1. `PAGE` and `NUMPAGES` fields render as nothing.** A footer whose Word
content is `Page {PAGE} of {NUMPAGES}` converts to the literal text
`Page  of ` — the numbers are absent, not merely wrong. This is worse than the
predicted failure, which was that one cloned footer would show the same number
on every page.

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

Page numbers are close to universal in business documents, and an empty
`Page  of ` reads as a bug in the converter rather than as a limitation. It is
the most visible defect remaining in Word conversion.

Repeating header rows matter on any multi-page table — a price list, a risk
register — where losing the headings makes later pages hard to read. Less
common than page numbers, and less visibly broken.

Neither affects the text layer beyond what is already recorded in
`word-conversion-text-layer-has-three-gaps.md`.

## Scope to decide

- Option A — Resolve `PAGE`/`NUMPAGES` ourselves. The converter is the one
  component that knows both numbers: `addSection` has the band index, and the
  total is known once every section is paginated. It would mean a two-pass
  render (paginate everything, then draw), and locating the field's placeholder
  in the rendered footer to substitute into. This is the higher-value half.
- OR Option B — Repeat `tblHeader` rows. Hard under the current paint-only
  staging, which slices a single rendered flow: the header row would have to be
  cloned and pinned at the top of each band that continues a table, in the
  layout rather than in the raster.
- OR Option C — Neither; disclose both on the discovery surfaces alongside the
  existing conversion caveats.

No code change made by this ticket — it is an observation on the record.
