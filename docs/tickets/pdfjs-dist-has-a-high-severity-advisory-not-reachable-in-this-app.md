# `npm audit` reports a high-severity pdfjs-dist advisory that this app cannot reach

Status: OPEN · Priority: MEDIUM · Type: dependency hygiene · Cost: none

> Priority is MEDIUM, not HIGH, on purpose: the advisory is real and the
> installed version is in range, but the vulnerable code path is not bundled.
> Read "Why it matters" before treating this as an incident — an earlier pass at
> this ticket did, and was wrong.

## Symptom

`npm audit --omit=dev` no longer reports zero vulnerabilities, which the
project's proof discipline has asserted since decision row 8:

```
$ npm audit --omit=dev
pdfjs-dist  >=5.6.83 <6.2.108
Severity: high
PDF.js: Arbitrary JavaScript execution upon opening a malicious PDF
  https://github.com/advisories/GHSA-hq66-cqwq-w95j
1 high severity vulnerability
```

CVE-2026-16633, CVSS 8.6, CWE-79. Installed: `pdfjs-dist@6.1.200`, declared
`^6.1.200`. Fixed in 6.2.108.

This is **pre-existing** — `git show v1.0.0:package.json` carries the same
`^6.1.200`, and neither `docx-preview` nor `@zumer/snapdom`, installed the same
day, contributes to it. The advisory was published after the last audit run.

## Evidence

The advisory's stated preconditions are: a malicious PDF is opened,
`enableScripting` is true (its default), and no CSP restricts `script-src`.

The second one cannot be met here, because `enableScripting` is a **viewer**
option and this app does not use the viewer:

```
$ grep -rl "enableScripting" node_modules/pdfjs-dist/
node_modules/pdfjs-dist/types/web/pdf_viewer.d.ts
node_modules/pdfjs-dist/types/web/annotation_layer_builder.d.ts
node_modules/pdfjs-dist/types/src/display/annotation_layer.d.ts
node_modules/pdfjs-dist/web/pdf_viewer.mjs.map
node_modules/pdfjs-dist/web/pdf_viewer.mjs

$ grep -rn "pdf_viewer\|PDFViewer\|PDFScriptingManager" src/
  (no matches)

$ grep -c "PDFScriptingManager" node_modules/pdfjs-dist/build/pdf.mjs
0
```

`src/lib/pdfjsWorkerSetup.ts` imports `pdfjs-dist` (the core build) and
`pdfjs-dist/build/pdf.worker.min.mjs` only. The app calls `getDocument()` and
`page.render()`; document scripting is executed by `PDFScriptingManager` in the
`web/` layer, which is neither imported nor present in the core build.

A confirming detail: adding `enableScripting: false` to the `getDocument()`
options **fails to type-check** — `TS2353: 'enableScripting' does not exist in
type 'DocumentInitParameters'` — because it was never a core-API option. Anyone
"fixing" this by passing that flag is adding a silent no-op.

## Why it matters

Not as an exploit. The vulnerable path is not in the bundle, so a malicious PDF
opened in Free PDF Machine does not get its JavaScript executed.

It matters for three smaller reasons:

- The 0-vulnerability audit result is part of this project's release evidence,
  and a non-zero audit devalues that check until it is either fixed or
  explained. This ticket is the explanation; the fix is still preferable.
- **The immunity is incidental, not designed.** Nothing stops a future session
  from importing `pdfjs-dist/web/pdf_viewer` for a nicer preview and silently
  acquiring the exposure, because no test or comment records that the core-only
  import is load-bearing for security.
- There is **no CSP on the site** (`grep -i content-security netlify.toml` is
  empty), so the advisory's second mitigation is also absent. That is worth
  fixing on its own merits for a site that markets itself for confidential
  documents, independently of this CVE.

## Scope to decide

- Option A — `npm audit fix` to take `pdfjs-dist` ≥ 6.2.108 and restore the zero
  result. It is a minor bump inside the existing `^6` range, but decision row 18
  applies: the build plugin copies `pdfjs-dist/wasm/` to `/pdfjs-wasm/`, so the
  upgrade rewrites those assets and the four scanned-PDF fixtures
  (CCITT G4, JPEG 2000, JPEG, Flate) must be re-verified to render, not merely
  to open — "a PDF that opens is not a PDF that renders".
- OR Option B — Option A, plus a comment in `pdfjsWorkerSetup.ts` recording that
  the core-only import is a security boundary, so a future viewer import is a
  deliberate decision rather than an accident.
- OR Option C — Option B, plus a `Content-Security-Policy` header in
  `netlify.toml`. Needs care: the app uses WebAssembly (`wasm-unsafe-eval`), web
  workers (`worker-src blob:`), blob/data URLs for previews and downloads, and
  Google Fonts, so a too-strict policy breaks rendering. Worth its own pass.

No code change made by this ticket — the `enableScripting` edit attempted while
investigating was reverted, and nothing else was touched.
