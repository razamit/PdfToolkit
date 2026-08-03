# Shared project instructions

Read and follow `CLAUDE.md` in full. It is the canonical, tool-agnostic project
guidance despite its filename; all of its engineering and product rules apply
to Codex too.

## Devlog

This project keeps a written record. Maintain it without being asked.

- **Starting work** — read the head of `docs/PROGRESS.md` (newest entry first)
  to learn current state, and check `docs/DECISIONS.md` before proposing
  anything it may have already settled. Existing decision rows are binding:
  supersede one deliberately with a new row, never silently.
- **Noticing a defect or gap you will not fix now** — file a ticket in
  `docs/tickets/` (Symptom → Evidence → Why it matters → Scope to decide).
  Never leave it as a TODO comment, a silent skip, or a remark in chat.
- **Making a consequential choice** — record it in `docs/DECISIONS.md` with
  its why and the alternatives rejected. A decision whose reasons are not
  written down will be reversed by a future session that cannot see them.
- **Finishing a unit of work** — prepend an entry to `docs/PROGRESS.md`:
  status marker, scope note, real proof (actual test output, before/after),
  files touched, and cross-references. State red tests honestly; never imply
  completeness you have not verified.
- **Before any requested commit** — write an evidence summary naming every
  path in `git status --short` / `git diff --stat`, including incidental edits
  and deletions, and verify it against the actual diff. Then update the logs in
  the same commit as the work, and only then commit. Never commit unless the
  user explicitly asked.

The installed `devlog` plugin skills (`devlog:progress-log`,
`devlog:decision-log`, `devlog:tickets`, and `devlog:session-wrap`) hold the
full conventions. Read the relevant skill before writing to these files.
