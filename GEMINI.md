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
