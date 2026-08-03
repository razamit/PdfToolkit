# Local OCR is undiscoverable until at least one page is selected

Status: CLOSED (2026-08-03) · Priority: MEDIUM · Type: discoverability · Cost: none

## Symptom

After a PDF is loaded, no OCR control appears in the main toolbar or on each
thumbnail. “OCR locally” exists only in `BulkActionBar`, and that entire bar
returns `null` while `selection.count === 0`. A user reported that they could not
see the Local English OCR feature.

## Evidence

Browser QA with a four-page fixture showed no OCR action immediately after load.
Clicking the first page's Select page control made a button named “OCR locally”
appear. The behavior is explicit in `src/components/BulkActionBar.tsx`:

```text
if (selection.count === 0) return null
...
<span className="hidden sm:inline">OCR locally</span>
```

## Why it matters

Selection-scoped execution is sensible for an expensive OCR operation, but
hiding its only entry point makes the shipped capability look absent and gives
users no clue that selecting pages reveals more actions. On small screens even
the revealed text label is hidden, leaving only the scan icon.

## Scope to decide

- Keep selection-scoped execution but expose a disabled OCR toolbar action with
  guidance to select pages; OR add OCR to a page menu; OR add a dedicated dialog
  that chooses pages.
- On mobile, give the icon-only action a visible label or sufficiently explicit
  accessible tooltip/instruction.

## Resolution

Closed by the 2026-08-03 progress entry “Made the multi-page action row
persistent and added first-class blank pages.” The complete bulk-action row now
remains visible whenever the document has pages. With no selection it says
“Nothing selected”; OCR and the other selection-dependent actions are visibly
disabled, while Select all remains available. Action labels remain visible on
mobile instead of collapsing to unexplained icons. Browser QA at 390px confirmed
all eight labels are present without horizontal overflow.
