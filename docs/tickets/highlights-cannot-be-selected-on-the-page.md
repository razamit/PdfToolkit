# A highlight can be selected from the items list but not by clicking it on the page

Status: OPEN · Priority: LOW · Type: UX gap · Cost: none

> Introduced with the items list (`docs/DECISIONS.md` row 21). Every other kind
> of mark supports both routes; highlights support only one.

## Symptom

In the page editing session, clicking a text box, an image or a signature on the
page selects it — the mark is ringed and its row in the items list lights up
(`selectOnPointerDown` in `src/hooks/useMarkTransform.ts:107`, wired at
`src/components/annotations/AnnotationOverlay.tsx` and
`src/components/signature/SignatureOverlay.tsx`).

Clicking a text-anchored highlight or a free-hand highlighter mark does nothing.
Selecting it from the items list works, and rings it, so the mark *can* be
selected — just not from the page.

## Evidence

Highlights are drawn inside an overlay that is `pointer-events-none`, and unlike
the movable marks they never opt back in:

```
$ grep -n "pointer-events" src/components/annotations/AnnotationOverlay.tsx
72:    <div ref={ref} className={cn('pointer-events-none absolute inset-0', className)}>
148:      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
196:      className={cn('absolute', movable && 'pointer-events-auto cursor-move touch-none')}
```

`movable` is `onTransform !== undefined`, and neither `PlacedHighlight` nor
`PlacedFreehandHighlight` takes `onTransform` — they are anchored to the page's
text and are deliberately not draggable. Their only pointer-interactive part is
the remove button on `FixedMarkAnchor`.

Verified in the browser (`agent-browser`, 2026-07-29): selecting either
highlight row rings the mark; clicking the ringed mark itself leaves the
previous selection unchanged.

## Why it matters

Small. The list is the discovery surface the feature was built for, and it
covers highlights fully — find, select, delete. The inconsistency only shows up
if a user reaches for a highlight on the page expecting the same response the
other marks give.

## Scope to decide

- Option A — leave it. A transparent `pointer-events-auto` box over a
  highlight's bounding box would sit on top of the page text and swallow the
  drag that the "Highlight text" tool needs to select text with, which is a
  worse regression than the gap it closes.
- OR Option B — make the anchor box clickable only while no tool is armed
  (the idle state), where nothing else wants those pointer events. Costs a
  prop threading the armed-tool state into the overlay, which currently knows
  nothing about tools.
- OR Option C — hit-test the strokes/line-rects instead of the bounding box, so
  the clickable area matches the ink rather than a rectangle over the text.
  Most precise, most work.

No code change made by this ticket — it is an observation on the record.
