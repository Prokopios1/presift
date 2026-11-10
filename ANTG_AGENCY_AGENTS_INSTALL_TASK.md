# ANTG Task — Install & Configure the "Agency Agents" persona suite

**Project:** `/home/fupazuzi/projects/b2b-assessment-engine` (preSift / assessment engine)
**Author:** A2 (Hermes), supervising on behalf of P.
**Mode:** supervised headless one-shot. Do steps 1–2, inspect, report. Then STOP.

---

## 1. ORDER (verbatim from P.)

I want to install and configure the **"Agency Agents"** persona suite into this project
workspace using my current Google Gemini subscription units.

Follow these strict constraints:

**1. SIMPLICITY & DEPENDENCIES**
- Use the simplest setup that works.
- Do NOT install complex Node/Python daemons or third-party wrappers.
- Clone `https://github.com/msitarzewski/agency-agents.git` into a temporary staging
  folder (`/tmp/agency-agents`), then organize the relevant agent persona markdown
  files directly into `.agents/rules/` within this project.

**2. ANTIGRAVITY RULES INTEGRATION**
- Ensure each imported persona in `.agents/rules/` has proper YAML frontmatter with
  `trigger: manual` so that multiple personas do not load simultaneously into the
  context window and blow past token quotas.
- Set up `AGENTS.md` (or update existing) to serve as a lightweight directory mapping
  each agency role to its respective file in `.agents/rules/`.

**3. MITIGATE GEMINI 429 (RESOURCE_EXHAUSTED / RATE LIMIT) ERRORS**
- Do NOT run bulk batch indexing or simultaneous multi-agent task loops that spam
  requests in tight sequences.
- For any automated operations or test scripts you generate:
  - Implement exponential backoff with jitter on HTTP 429 / RESOURCE_EXHAUSTED
    responses (base wait: 2s, doubling up to 60s, max 5 retries).
  - Throttle sequential agent steps with a minimum 2–3 second delay between chained
    tool executions.
  - Keep active prompt contexts trimmed: load only the specific persona requested for
    the task rather than concatenating the entire agency catalog.

Execute step 1 and step 2, inspect the directory structure, and confirm once
`.agents/rules/` is populated and indexed.

---

## 2. EXECUTION CONTRACT (A2 — binding)

### 2.1 Scope lock (overrides the repo GEMINI.md permanent lock, for THIS task only)

You may **create/modify ONLY**:

- `/tmp/agency-agents/**` — staging clone (pre-cloned by A2; re-clone only if the
  directory is missing or empty).
- `<repo>/.agents/rules/**` — the imported persona rule files (new directory).
- `<repo>/.agents/README.md` — optional short note on how to use the rules (new).
- `<repo>/AGENTS.md` — new root index file.
- `<repo>/scripts/agency-agents-import.sh` — the single import helper script (new).

Everything else in the repo is READ-ONLY. Do **not** touch `GEMINI.md`,
`package.json`, `src/**`, `functions/**`, tests, configs, or any existing file. If you
find a problem elsewhere, REPORT it — do not fix it.

**No-revert rule:** never `git checkout --`, `git reset`, `git restore`, `rm -rf` on
repo content, or overwrite any tracked file. The install is purely additive.

### 2.2 Headless-safe commands

Run under non-interactive mode. Do NOT use `find -exec` / `find -execdir` (auto-denied).
Prefer simple commands/pipelines of `ls cat grep find sort head tail du stat wc pwd git
node npm mkdir cp mv echo true`. Avoid `2>/dev/null` and `|| true` unless truly needed.

### 2.3 Rate-limit discipline (constraint 3)

This install is a **single-pass file copy** — no bulk indexing loop, no multi-agent
loop, no per-file API calls. Do not call the model in a loop. Pace chained tool steps
with a 2–3 s gap. If a script performs any network/HTTP operation, wrap it in the
backoff helper (`exponential backoff + jitter, base 2 s, ×2 up to 60 s, max 5 retries`).

### 2.4 Deliverables — exact shape

**A. Persona rule files.** For **every** persona markdown file found in the staging
clone under the division directories:

```
academic design engineering finance game-development gis healthcare marketing
paid-media product project-management research sales security spatial-computing
specialized support testing
```

(exclude `integrations/ examples/ scripts/ strategy/ .github/` and repo-root files)
create one file at:

```
<repo>/.agents/rules/<slug>.md
```

where `<slug>` is the staging file's basename (e.g. `marketing-seo-specialist.md` →
`.agents/rules/marketing-seo-specialist.md`). Keep the persona body verbatim.

Each output file MUST start with YAML frontmatter that **preserves** the source
`name` and `description` and **adds** `trigger: manual`:

```yaml
---
name: <source name>
description: <source description>
trigger: manual
division: <division dir>
source_file: <division>/<basename>.md
---
```

Do not add any other frontmatter keys that could be interpreted as an auto-trigger.
`trigger: manual` must be present in **all** rule files so no persona auto-loads.

**B. AGENTS.md (root index).** Create `<repo>/AGENTS.md` as a **lightweight** directory
mapping — it is an always-on rule, so keep it small (target < 150 lines):

1. One short paragraph: what this is, that personas live in `.agents/rules/`, and that
   they are `trigger: manual` (never auto-load).
2. The activation instruction: to use a persona, read only
   `.agents/rules/<slug>.md` for the requested role — never concatenate the catalog.
3. A per-division table: division | count | slugs (comma-separated, compact).

Do NOT inline persona bodies into AGENTS.md.

**C. Import script.** `<repo>/scripts/agency-agents-import.sh` — bash, no external
deps, idempotent (safe to re-run). It must (a) clone/pull the repo into
`/tmp/agency-agents` if absent, (b) copy the personas into `.agents/rules/` with the
frontmatter transform above, (c) contain the documented `backoff()` helper for the
clone step. `chmod +x`. Must NOT depend on `find -exec`.

### 2.5 Definition of done

- `.agents/rules/` exists and contains one `.md` per staged persona (report the count).
- Every file in `.agents/rules/` contains `trigger: manual` (verify with `grep -rl`).
- `AGENTS.md` exists at repo root and maps divisions → slugs.
- `scripts/agency-agents-import.sh` exists and is executable.
- `git status --short` shows only the new `.agents/`, `AGENTS.md`,
  `scripts/agency-agents-import.sh` (plus nothing else).

### 2.6 Report format

End with a short report: files created (counts), the division table, the exact command
lines you ran, and any gaps. Then **STOP — do not commit, do not deploy, do not run
any audit.** A2 verifies first.
