# An image whose browser-reported MIME type is empty or wrong is rejected before its bytes are read

Status: OPEN · Priority: LOW · Type: import robustness · Cost: none

> Found while fixing the mislabelled-image export failure (progress entry
> 2026-10-06, decision row 42). That fix made the image loaders trust the
> file's bytes instead of its MIME type. This ticket is the same assumption one
> level up, in the dispatcher that decides whether a file reaches the image
> loader at all. It was left alone because fixing it changes which error
> message unknown files get, which is a wording choice and not part of the bug.

## Symptom

`loadFile` in `src/coordinator/PdfToolkitCoordinator.tsx:190` routes a file to
`ImageImportManager` only when `file.type.startsWith('image/')`. A real JPEG or
PNG that arrives with an empty `type` never reaches the byte check and is
answered with `"<name>" isn't a PDF or image we can read.`

Not reproduced in a browser this session. It is read from the code, and from
`src/lib/fileAccept.ts`, whose own comment says "some platforms report an
unhelpful MIME type, or nothing at all" and that drag-and-drop is unfiltered.

## Evidence

```
$ grep -n "startsWith('image/')" src/coordinator/PdfToolkitCoordinator.tsx
190:      if (file.type.startsWith('image/')) {
```

`src/lib/imageFormat.ts` (`detectImageFormat`) can now answer the question from
the first 8 bytes, so the MIME gate is no longer the only way to tell.

## Why it matters

Low. Browsers derive `type` from the extension, so a `.jpg` or `.png` picked or
dropped on desktop Chrome, Safari and Firefox reports `image/*` correctly. The
exposure is an image with no extension or an unknown one, and platforms that
report nothing for dropped files. The failure is a clear rejection at add time,
not a late export error, so nothing is lost silently.

## Scope to decide

- Option A: in `loadFile`, after the PDF and Office checks, sniff the bytes and
  send anything `detectImageFormat` recognises to `ImageImportManager`
  regardless of `file.type`. Unknown files keep today's generic message.
- OR Option B: leave as is until a real report shows a platform that does this.

No code change made by this ticket. It is an observation on the record.
