# Multi-column Word sections capture with text drawn over itself

Status: CLOSED (2026-08-09) — WON'T FIX · Priority: LOW · Type: third-party limitation · Cost: none

> **Closed 2026-08-09 — won't fix.** Office conversion was removed from the
> product entirely; see decision row 41 in `docs/DECISIONS.md` and the
> 2026-08-09 entry in `docs/PROGRESS.md`. The application that owns the format
> exports a more faithful PDF than any in-browser converter can, so the product
> now points the user at File → Print → Save as PDF instead of converting. This
> ticket's subject no longer exists in the codebase; it is kept as the record of
> what was observed.
>
> Moot: `@zumer/snapdom` was the rasterizer for Word conversion and has been removed from the dependency list along with it, so nothing in the product hits this third-party bug.

> The fault is in the capture library, not in this codebase — the live DOM is
> correct and only the rasterised copy is wrong. Recorded so the next person to
> see it does not spend the afternoon looking in the pagination code, as this
> session did.

## Symptom

A section using `<w:cols w:num="2"/>` converts with overlapping text: in the
second column, two different runs of body text are painted on top of each
other, making both unreadable.

## Evidence

`docs/samples/stress_test_2.docx` has a two-column final section.

The section is **not** paginated — its flow measures 416px against an 864px
band, so it is a single band and no `clip-path`/`transform` windowing is in
play. That rules out this project's page slicing.

Screenshotting the live rendered DOM for that section shows two clean columns
with correct flow and no overlap. The same element captured through
`@zumer/snapdom` and embedded in the PDF shows the overlap. The defect is
introduced by the capture.

Attempted and rejected as a workaround: pinning the element's height and setting
`column-fill: auto` before capture, on the theory that the clone was free to
re-balance its columns. It made no difference and changed the live column
behaviour, so it was reverted.

## Why it matters

Low, on current evidence. Two-column layouts are uncommon in the documents this
feature exists for — contracts, letters, reports, CVs — and none of the four
real documents tested so far uses one. But when it does happen the page is
unreadable rather than merely imperfect, so it is a bad failure when it occurs.

## Scope to decide

- Option A — Leave it and disclose multi-column as unsupported.
- OR Option B — Try `html-to-image` (308 kB, MIT, zero dependencies) for the
  capture and see whether it handles CSS columns correctly. If it does, the
  capture layer is a single module (`docxRasterize.ts`) and swapping it is
  contained; if it does not, nothing is lost but the experiment.
- OR Option C — Flatten columns before capture: measure each column's fragment
  positions and re-emit them as absolutely positioned blocks. Robust against any
  capture library, but it is real layout work and touches the one rule that
  keeps staging safe — that it must never alter layout.
- OR Option D — Report upstream to snapdom with this fixture.

No code change made by this ticket — the workaround attempted while
investigating was reverted.
