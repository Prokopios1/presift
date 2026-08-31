# Headless-safe command rules

When running under non-interactive (print/headless) mode with a permission allow-list:

- NEVER use `find -exec ...` (or `find -execdir ...`). The permission engine cannot
  match `-exec` subcommands inside pipelines, so these commands are auto-denied in
  headless mode.
- For listing the largest files in this repo, prefer one of these (all
  allow-listed): `ls -laS | head -n 6` or `du -ah . | sort -rh | head -n 5` or
  `find . -type f -printf '%s %p\n' | sort -nr | head -n 5`.
- Keep commands simple: single commands or pipelines of allow-listed tools
  (`ls`, `cat`, `grep`, `find`, `sort`, `head`, `tail`, `du`, `stat`, `wc`,
  `pwd`, `git`, `node`, `npm`, `firebase`, `tsc`, `mkdir`, `cp`, `mv`, `echo`,
  `true`).
- Avoid `2>/dev/null` redirections unless necessary; avoid `|| true` / `|| echo`
  wrappers.

# PERMANENT SCOPE LOCK (applies to EVERY task — A2/Hermes enforced)

- You may modify ONLY the files explicitly listed in the task. That list is
  exhaustive: no other file may be created, modified, reverted, deleted, or
  touched in any way — no config, no package.json, no unrelated tests, no
  "improvements", no refactors, no lint cleanups outside the listed files.
- If you discover another problem, REPORT it in your final message. Do NOT fix it.
- If your edit tool fails, re-read the current file and adapt — never ask the
  user "which issues should I address". Complete the task as specified.
- Run `npm run verify` and report its output. STOP — do not commit or deploy
  until A2 sign-off.
