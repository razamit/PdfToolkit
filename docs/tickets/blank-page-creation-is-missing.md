# The editor has no way to insert a blank page

Status: CLOSED (2026-08-03) · Priority: MEDIUM · Type: feature gap · Cost: none

## Symptom

After loading a document, the toolbar offers Add PDFs, Add images, Undo, Redo,
Split, Crop, Stamps, Forms, Reset and Export, but no Add blank page action. The
user expected this in the feature expansion and reported that it could not be
found on 2026-08-03.

## Evidence

Browser QA against `http://127.0.0.1:5173/` with a four-page fixture exposed the
toolbar actions above and no blank-page action. Repository search also found no
implementation:

```text
$ rg -n "Add blank|blank page|createBlank|insertBlank" src README.md public index.html
(no matches)
```

## Why it matters

A blank page is the starting point for adding a signature, note, image or other
annotation when the desired page does not already exist in an input document.
This is not a hidden control or discoverability issue; the underlying document
operation is absent.

## Scope to decide

- Decide the default page size: current document's dominant size, A4, Letter, or
  a chooser at insertion time.
- Decide placement: append only, insert after the selected page, or both.
- Decide whether a blank page is represented as a synthetic PDF source or as a
  first-class page kind; it must participate in reorder, undo/redo, crop,
  annotations, OCR/export selection and source-color behavior consistently.

## Resolution

Closed by the 2026-08-03 progress entry “Made the multi-page action row
persistent and added first-class blank pages” and decision row 31. “Add blank
page” is available both before and after files are loaded. A new blank appends
to the document, matches its prevailing non-image page size (A4 portrait when
there is no paper-sized page), participates in undo/redo and ordinary page
editing, and exports as a real page. Browser QA verified a standalone annotated
A4 blank and a fifth 612×792 page added to a four-page Letter document.
