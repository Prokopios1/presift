# Antigravity Task Template — use this structure for EVERY task

Copy this block, fill in the sections. Do not delete the Evidence Checklist — it is mandatory.

---

**Task: <one-line title>**

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** <why this change exists, 2-3 sentences>

**Changes:**
1. <file + exact change>
2. <file + exact change>

**Explicitly out of scope:** <list, e.g. functions/, firestore.rules, e2e/, other pages>

**Constraints:**
- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output (this is NOT a real typecheck; see below)
- [ ] `npm run build` — paste VERBATIM output. **Build success is the real gate** (root tsconfig.json is solution-style: `"files": []`, so `tsc --noEmit` in verify checks zero files).
- [ ] Every changed file: path + the diff/lines changed, confirmed present on disk (`ls -la` / `stat`).
- [ ] If screenshots required: **do not take them yourself** — state that Hermes will capture them, or save raw files to the repo and give paths (never link `file://` sandbox paths).
- [ ] State exactly which files you modified, with timestamps.

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.

---

## Agent routing rules (A1 decides)

| Task type | Agent |
|---|---|
| Small mechanical edit (single element, one file, test sync) | Hermes |
| Large feature / multi-file refactor / architecture | Antigravity |
| Visual verification / screenshots | Hermes (Playwright) |
| Build, deploy, setup, git | Hermes |
| Verification of outputs | A1 (controller) |
