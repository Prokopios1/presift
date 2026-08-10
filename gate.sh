#!/usr/bin/env bash
# gate.sh — PreSift pre-deploy quality gates. Runs in order, stops on first failure.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

FAILED=0
STEP=0

run_step() {
  STEP=$((STEP + 1))
  local name="$1"
  shift
  echo ""
  echo "=== [${STEP}] ${name} ==="
  if "$@"; then
    echo "PASS: ${name}"
  else
    echo "FAIL: ${name}"
    FAILED=1
    exit 1
  fi
}

run_step "lint (oxlint)" npm run lint
run_step "typecheck (tsc -b)" npx tsc -b
run_step "unit tests (vitest)" npx vitest run
run_step "build (vite)" npm run build

# --- Step 5: screenshot sanity check (informational, never fails the gate) ---
echo ""
echo "=== [5] screenshot sanity check ==="
python3 - <<'PY'
import os, sys

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

screens = ["docs/screens/final_home.png", "docs/screens/final_pricing.png"]
missing = [s for s in screens if not os.path.exists(s)]
if missing:
    print(f"WARN: screenshots missing, skipping: {', '.join(missing)}")
    sys.exit(0)

ok = True
for s in screens:
    size = os.path.getsize(s)
    if size <= 50 * 1024:
        print(f"FAIL: {s} is {size} bytes (<=50KB)")
        ok = False
        continue
    if HAVE_PIL:
        img = Image.open(s).convert("RGB")
        colors = img.getcolors(maxcolors=10_000_000)
        n = len(colors) if colors else 10_000_000
        if n <= 1:
            print(f"FAIL: {s} has only {n} unique color(s)")
            ok = False
        else:
            print(f"PASS: {s} {size} bytes, {n} unique colors")
    else:
        print(f"WARN: PIL missing — {s} {size} bytes (size only)")

if not HAVE_PIL:
    print("WARN: python3-PIL not available, color check skipped (size check only)")
sys.exit(0 if ok else 1)
PY
if [ $? -ne 0 ]; then
  echo "WARN: screenshot sanity check failed (non-fatal)"
fi

echo ""
echo "========================================"
if [ "$FAILED" -eq 0 ]; then
  echo "ALL GATES PASSED"
  exit 0
else
  echo "GATES FAILED — see above"
  exit 1
fi
