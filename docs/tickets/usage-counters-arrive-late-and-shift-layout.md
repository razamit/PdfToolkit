# The usage counters render only after `/api/usage` resolves, so they pop in and push everything below them down

Status: OPEN · Priority: LOW · Type: performance — layout stability · Cost: none

> Pre-existing, not introduced by the landing-content work, but that work made it
> matter more: there is now content below the counters for them to displace.
> Distinct from decision row 16, which fixed the *static* reservation mismatch;
> this is the remaining *dynamic* one. Also the reason row 15's measurements were
> wrong, so it is worth reading alongside.

## Symptom

`UsageCounters` returns `null` until `useUsageCounters` has fetched `/api/usage`
and the summed total clears the display threshold. On a cold load the empty
state therefore renders without the counter panel, and then grows by roughly
260px when the fetch resolves, pushing the "How it works" link and the whole
static landing section below it further down the page.

The panel is ~260px of the empty-state card's 747px on production.

## Evidence

Measured on production with `agent-browser` at 1280x900, after the fetch had
resolved:

```
{ "vpH": 900, "rootH": 856, "headerH": 61, "mainH": 795,
  "emptyBoxH": 747, "countersH": 747 }
```

The same page served by `npm run preview`, where `/api/usage` 404s and the panel
never renders, measures the app at 624 to 720px depending on viewport. That gap
between the two environments is the counters.

## Why it matters

Less than it looks, and the honest version matters here.

The shift happens below the fold on most viewports, and Cumulative Layout Shift
only scores movement of *visible* content, so the scored impact is small. The
counters are also a decorative feature (decision row 8), not something a user is
waiting for.

What it genuinely cost was a **verification** failure rather than a user-facing
one: because the panel is invisible in local preview, layout work measured
locally is measured against a page 130 to 500px shorter than production. That is
exactly how decision row 15 shipped a 509px mobile layout shift while reporting
"zero shift" (corrected in row 16).

## Scope to decide

- **Option A — reserve the panel's height.** Have `UsageCounters` render a
  fixed-height container while loading and when hidden, so the empty state's
  height is the same before and after the fetch. Removes the shift entirely. The
  cost is ~260px of permanently reserved space on a fresh deployment where the
  counters never clear the display threshold, which is a transient state.
- OR **Option B — stub `/api/usage` in local preview** so the environments match
  and the trap that caught row 15 cannot catch anyone again, while leaving the
  runtime shift alone. Fixes the verification problem, not the layout one.
- OR **Option C — do both.** A is the user-facing fix and B is the process fix;
  they are independent and neither implies the other.
- OR **Option D — accept it.** Defensible: the movement is below the fold on
  most viewports and the counters are decorative. If chosen, close this as
  WON'T FIX with a decision row, and keep the row 16 verification rule
  ("measure against production, never a bare `vite preview`") prominent, because
  that rule is then the only thing preventing a repeat.

No code change made by this ticket — it is an observation on the record.
