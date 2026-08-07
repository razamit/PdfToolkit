# Spreadsheet number formats are honoured only as a bounded subset

Status: OPEN · Priority: LOW · Type: known scope limit · Cost: none

> Deliberate scope of decision row 32. Distinct from
> `spreadsheet-conversion-does-not-reproduce-workbook-formatting.md`, which
> covers everything that is not a cell value.

## Symptom

`src/lib/sheets/xlsx/numberFormat.ts` reads an ECMA-376 format code only far
enough to answer four questions — date, time, percentage, or fixed decimals —
and routes everything else through a general number path. Specifically not
implemented:

- **Date token order is ignored.** A cell formatted `dd/mm/yyyy` and a cell
  formatted `mm/dd/yyyy` both render as `YYYY-MM-DD`.
- Locale tokens and `[$-409]`-style section prefixes are stripped, not applied.
- Colour and condition sections (`[Red]`, `[>100]`) are stripped.
- Text sections (the 4th `;` section) are ignored.
- Fractions (`# ?/?`), scientific notation (`0.00E+00`) and the trailing-comma
  thousands *scale* marker fall through to the general number path.
- Built-in ids outside the table in `BUILT_IN_NUMBER_CODES` and the date/time
  id sets are treated as General.

## Evidence

The ISO date shape is a deliberate choice, recorded in the file's header
comment: guessing wrong between `dd/mm` and `mm/dd` silently changes what the
data says, and `03/04/2026` is unrecoverably ambiguous to a reader, whereas
`2026-04-03` is not. Verified in browser QA against a hand-built fixture whose
`Closed` column is `numFmtId="14"`:

```
$ pdftotext -f 1 -l 1 -layout freepdfmachine-export.pdf -
 Region    Owner              Closed              Revenue    Margin   Active
 North     מחלקת מכירות        2020-01-01     1,234,567.89     12.3%   TRUE
 South                        1900-02-28        -2,500.00     50.0%   FALSE
 Inline    =FORMULA result    2022-01-01 12:00:00       0.3   #DIV/0!
```

Serial `43831` → `2020-01-01` and serial `59` → `1900-02-28` both correct
(the two branches of the Lotus leap-year bug); `numFmtId="4"` with no
`formatCode` → `1,234,567.89`; custom `0.0%` → `12.3%`; `numFmtId="22"` →
`2022-01-01 12:00:00`.

## Why it matters

Low. The subset covers what business spreadsheets actually use, and the one
visible divergence — ISO dates instead of the author's chosen order — is a
readability trade rather than a data error.

It would matter if a user converts a sheet whose date order is itself the
point (a form that must match a printed original), or a scientific sheet where
`1.2E+09` rendering as `1200000000` changes how the column reads.

## Scope to decide

- Option A — Leave it. Correct values, one unambiguous date shape.
- OR Option B — Implement date token order (`d`, `dd`, `m`, `mm`, `mmm`, `yy`,
  `yyyy`, `h`, `hh`, `ss`, `AM/PM`) so dates render as the author wrote them.
  Contained: one formatter, no new parsing surface.
- OR Option C — Add scientific notation and fractions too. Each is a small
  independent branch; only worth it if a real file turns up that needs them.

No code change made by this ticket — it is an observation on the record.
