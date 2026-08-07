# A file literally named `--full-page` is tracked at the repository root

Status: OPEN · Priority: LOW · Type: repo hygiene · Cost: none

## Symptom

`./--full-page` is a committed PNG at the repository root. It is a screenshot
that landed there because a browser-QA command was written as
`agent-browser screenshot <path> --full-page` where that flag is not supported,
so the CLI treated `--full-page` as the output filename.

It was committed in `9f981e7` ("feat: add TextEditTool component…") and has
been tracked since. During the 2026-08-06 spreadsheet session the same mistake
recurred and silently *overwrote* it, which is how it was noticed:

```
$ git status --short
 M --full-page
$ git log --oneline -1 -- './--full-page'
9f981e7 feat: add TextEditTool component for re-editing placed text marks in PDF
$ file './--full-page'
./--full-page: PNG image data, 390 x 844, 8-bit/color RGB, non-interlaced
```

It was restored with `git checkout -- './--full-page'` so that session's diff
stayed clean.

## Why it matters

Small but real, and self-reproducing:

- It rides into `git status` as an unrelated modification whenever anyone
  repeats the flag mistake, which is exactly the class of stray change the
  session-wrap discipline in `CLAUDE.md` exists to catch. This session caught
  it; a faster one would have committed a mystery binary diff.
- The leading `--` makes it awkward to handle: most commands need `./` or `--`
  in front of it or they parse it as an option.
- It is 52 KB of nothing, at the root, where it looks like it might be
  meaningful.

It is not shipped — `dist/` is built from `index.html` and `public/`, so the
file never reaches the site.

## Scope to decide

- Option A — `git rm -- './--full-page'` in the next commit. Nothing references
  it; it has no purpose.
- OR Option B — Delete it and add a `--*` entry to `.gitignore` so a repeat of
  the flag mistake cannot be committed again.
- OR Option C — Leave it.

No code change made by this ticket — the file was restored to its committed
state, not deleted, because deleting a tracked file is the maintainer's call.
