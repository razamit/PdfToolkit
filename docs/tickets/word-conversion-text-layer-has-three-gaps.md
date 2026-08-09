# The invisible text layer on converted Word pages misses three things

Status: CLOSED (2026-08-09) — WON'T FIX · Priority: LOW · Type: known scope limit · Cost: none

> **Closed 2026-08-09 — won't fix.** Office conversion was removed from the
> product entirely; see decision row 41 in `docs/DECISIONS.md` and the
> 2026-08-09 entry in `docs/PROGRESS.md`. The application that owns the format
> exports a more faithful PDF than any in-browser converter can, so the product
> now points the user at File → Print → Save as PDF instead of converting. This
> ticket's subject no longer exists in the codebase; it is kept as the record of
> what was observed.
>
> Moot: Word conversion no longer exists, so there is no text layer with gaps.

> Deliberate scope of decision row 35. The *visible* page is complete in every
> case below — these are gaps in what can be selected, searched and copied, not
> in what is shown.

## Symptom

A converted `.docx` page is a raster of the browser's rendering with an
invisible text layer over it. Three kinds of text are visible in the raster but
absent from that layer:

1. **List markers.** Bullets and numbers are drawn by a CSS pseudo-element, so
   they are not DOM text and `extractTextRuns` cannot see them. Copying a
   numbered list yields the items without their numbers.
2. **Headers and footers.** The footer is cloned onto every page by
   `docxStage.ts`, but only the flowed article contributes runs, so no page's
   footer is searchable.
3. **Words split across a page break.** `runsForBand` drops a word that
   straddles a band boundary rather than duplicating it onto both pages.

## Evidence

Measured on `Litivest_Engagement_Structure_updated.docx` (4 pages, heavy RTL):

```
whole document, one flow : 1051 words
sum of the four pages    : 1047 words
```

4 words, ~0.4%, lost at the three break points. (This was 11 words until the
band geometry was moved into the flowed element's own space — see the progress
entry of 2026-08-07; measuring before staging put every break a few pixels off.) Breaks are already chosen to
avoid cutting lines (`computePageBands`), but the pull-back is capped at 25% of
a page, so an object taller than that — a tall table row — is cut anyway and its
words straddle.

For markers, `getComputedStyle(el, '::before').content` returns
`"" counter(docx-num-2-0) ".\9 "`, confirming the text lives on the pseudo-element
rather than in the DOM.

## Why it matters

Modestly. The pages look right, print right, and the body text — the
overwhelming majority of what anyone searches for — selects correctly. Word's
own PDF export does include list markers as real text, so this is a genuine if
narrow divergence.

It would matter to someone copying a numbered procedure out of a converted
document and finding the numbering gone, or searching a long document for a
phrase that happens to sit across a page break.

## Scope to decide

- Option A — Leave it. The visible page is correct and the gap is ~1%.
- OR Option B — Fix markers only: `docxMarkers.ts` already resolves each marker
  to literal text in order to pin it back onto the pseudo-element. The same
  resolved string could instead be emitted as a real span, which would make it
  selectable — at the cost of the layout risk that flattening into the
  pseudo-element was chosen to avoid. Worth measuring before adopting.
- OR Option C — Fix straddling words by assigning each to whichever band holds
  the larger part of its box, instead of dropping it. Cheap, and turns a missing
  word into a slightly mispositioned one.
- OR Option D — Give headers and footers their own run extraction, mapped to
  each page's margin area.

No code change made by this ticket — it is an observation on the record.
