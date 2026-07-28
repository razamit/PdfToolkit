# `cMapUrl` is not passed to pdf.js, so CJK text in non-embedded-font PDFs may render blank or garbled

Status: OPEN · Priority: LOW · Type: rendering fidelity · Cost: none

> Adjacent to the `wasmUrl` gap fixed by decision row 18 — same class of defect
> (a pdf.js runtime asset the app never told it where to find), different asset
> and different symptom. Filed separately because, unlike `wasmUrl`, this one is
> **not reproduced**: it is an observation from the API contract, not from a
> failing document.

## Symptom

Not observed in the wild. Predicted: a PDF whose text uses a predefined CMap
encoding (`/Encoding /UniJIS-UCS2-H`, `/GBK-EUC-H`, `/UniKS-UCS2-H`, …) with a
non-embedded CJK font would render its text incorrectly or not at all in the
thumbnail grid and the annotation preview — the same silent blankness the
`wasmUrl` gap produced for scans, since both surfaces share
`ThumbnailRenderManager`.

## Evidence

`src/managers/PdfSourceManager.ts` passes `wasmUrl` but neither `cMapUrl` nor
`cMapPacked`:

```
$ grep -n "getDocument" -A 6 src/managers/PdfSourceManager.ts
    return pdfjsLib.getDocument({
      data: bytes.slice(),
      password: '',
      wasmUrl: PDFJS_WASM_BASE,
    })
```

`pdfjs-dist` ships the data these options point at, unreferenced by this build:

```
$ du -sh node_modules/pdfjs-dist/cmaps node_modules/pdfjs-dist/standard_fonts
1.6M	node_modules/pdfjs-dist/cmaps          # 169 files
800K	node_modules/pdfjs-dist/standard_fonts
```

Two findings that bound how much this matters, both established while fixing
the `wasmUrl` gap — recorded here so a future session does not re-derive them:

1. **`standardFontDataUrl` is NOT needed.** A hand-built PDF drawing text with
   non-embedded `/Helvetica` (`scratch: text-standard14.pdf`) renders correctly
   today, with an empty console. pdf.js substitutes a local font for the
   standard 14. So the missing-font risk is confined to predefined CMaps.
2. **`useWorkerFetch` is currently `false`**, and passing `wasmUrl` alone cannot
   turn it on — `build/pdf.mjs:15189` enables it only when `cMapUrl &&
   cMapPacked && standardFontDataUrl && wasmUrl` are *all* set and valid. So the
   ~250 KB `openjpeg.wasm` is fetched on the main thread and copied to the
   worker over `postMessage` rather than fetched inside the worker. This is a
   one-off cost the first time a JPEG 2000 scan is opened, and it is why fixing
   this ticket would also be a small performance win, not only a correctness one.

## Why it matters

Less than it looks. Modern CJK PDFs from Word, InDesign and browser
"Print to PDF" embed their font subsets, and embedded fonts need no CMap; the
predefined-CMap path is mostly older documents and some Asian-market government
and banking output. Against that, the failure mode is the bad one this project
has now hit once: the document opens, the page count is right, the export is
byte-for-byte correct, and only the *displayed* page is wrong — so a user cannot
tell the tool failed, and the app logs nothing.

The `wasmUrl` fix already built the delivery mechanism
(`vite/pdfjsWasmPlugin.ts` serves a fixed-name directory out of `node_modules`
in both dev and build), so closing this is a small generalisation of an existing
plugin rather than new machinery.

## Scope to decide

- Option A — Generalise `pdfjsWasmPlugin` into a `pdfjsAssetsPlugin` that also
  serves `cmaps/` and `standard_fonts/`, and pass all four options
  (`cMapUrl`, `cMapPacked: true`, `standardFontDataUrl`, `wasmUrl`). Also flips
  `useWorkerFetch` to `true`, removing the main-thread hop above. Costs ~2.4 MB
  of build output that is only fetched on demand.
- OR Option B — Pass `cMapUrl`/`cMapPacked` only, leaving `standardFontDataUrl`
  unset since finding 1 shows it is not needed. Cheaper (1.6 MB), but leaves
  `useWorkerFetch` at `false`, so the wasm main-thread hop stays.
- OR Option C — Won't-fix until a real document reproduces it. Defensible given
  this is unreproduced; the cost is that the next occurrence is again invisible.

Whichever is chosen, add a CJK fixture to the scan fixtures so the claim is
tested rather than argued.

No code change made by this ticket — it is an observation on the record.
