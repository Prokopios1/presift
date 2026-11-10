#!/usr/bin/env bash
#
# agency-agents-import.sh — import and configure Agency Agents persona suite
#
# Idempotent import helper.
# 1. Clones/pulls https://github.com/msitarzewski/agency-agents.git into ~/agency-agents
#    (override with STAGE_DIR=/path/to/checkout). Durable location — the desktop app
#    (com.zerologic.agency-agents-app) points at the same checkout via its
#    state/catalog.json, so both share one source of truth.
# 2. Applies frontmatter transforms to .agents/rules/*.md with trigger: manual
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE_DIR="${STAGE_DIR:-$HOME/agency-agents}"
RULES_DIR="$REPO_ROOT/.agents/rules"

DIVISIONS=(
  academic
  design
  engineering
  finance
  game-development
  gis
  healthcare
  marketing
  paid-media
  product
  project-management
  research
  sales
  security
  spatial-computing
  specialized
  support
  testing
)

# backoff <command...>
# Implements exponential backoff with jitter on HTTP 429 / RESOURCE_EXHAUSTED responses:
# base wait: 2s, doubling up to 60s, max 5 retries.
backoff() {
  local max_retries=5
  local base_wait=2
  local max_wait=60
  local attempt=1
  local wait_time=$base_wait

  while true; do
    if "$@"; then
      return 0
    fi

    if (( attempt > max_retries )); then
      echo "[ERROR] Command failed after $max_retries attempts: $*" >&2
      return 1
    fi

    local jitter
    jitter=$(( RANDOM % 1000 ))
    local sleep_sec
    if (( wait_time > max_wait )); then
      wait_time=$max_wait
    fi
    sleep_sec=$(awk -v w="$wait_time" -v j="$jitter" 'BEGIN { printf "%.2f", w + (j / 1000) }')

    echo "[WARN] Command failed (attempt $attempt/$max_retries). Backing off for ${sleep_sec}s..." >&2
    sleep "$sleep_sec"

    wait_time=$(( wait_time * 2 ))
    attempt=$(( attempt + 1 ))
  done
}

# 1. Clone staging repo if absent
if [[ ! -d "$STAGE_DIR/.git" ]]; then
  echo "Cloning agency-agents repository into $STAGE_DIR..."
  mkdir -p "$(dirname "$STAGE_DIR")"
  backoff git clone https://github.com/msitarzewski/agency-agents.git "$STAGE_DIR"
else
  echo "Staging directory $STAGE_DIR already present."
fi

# 2. Prepare destination directory
mkdir -p "$RULES_DIR"

total_count=0

# 3. Process each division
for div in "${DIVISIONS[@]}"; do
  div_dir="$STAGE_DIR/$div"
  if [[ ! -d "$div_dir" ]]; then
    echo "[WARN] Division directory $div_dir not found, skipping." >&2
    continue
  fi

  div_count=0
  while IFS= read -r file; do
    slug_file="$(basename "$file")"
    dest="$RULES_DIR/$slug_file"
    source_file="${file#"$STAGE_DIR/"}"

    awk -v div="$div" -v src="$source_file" '
    BEGIN {
      fm = 0
      in_name = 0
      in_desc = 0
      name_str = ""
      desc_str = ""
    }
    /^---$/ {
      fm++
      if (fm == 1) next
      if (fm == 2) {
        print "---"
        printf "%s\n", name_str
        printf "%s\n", desc_str
        print "trigger: manual"
        print "division: " div
        print "source_file: " src
        print "---"
        next
      }
    }
    fm == 1 {
      if ($0 ~ /^name:[ \t]*/) {
        in_name = 1
        in_desc = 0
        val = $0
        sub(/^name:[ \t]+/, "", val)
        name_str = "name: " val
        next
      }
      if ($0 ~ /^description:[ \t]*/) {
        in_name = 0
        in_desc = 1
        val = $0
        sub(/^description:[ \t]+/, "", val)
        desc_str = "description: " val
        next
      }
      if ($0 ~ /^[a-zA-Z0-9_-]+:[ \t]*/) {
        in_name = 0
        in_desc = 0
        next
      }
      if (in_desc && $0 ~ /^[ \t]+/) {
        desc_str = desc_str "\n" $0
        next
      }
      if (in_name && $0 ~ /^[ \t]+/) {
        name_str = name_str "\n" $0
        next
      }
      in_name = 0
      in_desc = 0
      next
    }
    fm >= 2 {
      print
    }
    ' "$file" > "$dest"

    div_count=$(( div_count + 1 ))
    total_count=$(( total_count + 1 ))
  done < <(find "$div_dir" -type f -name "*.md" | sort)

  echo "Imported $div_count personas for division: $div"
done

echo "Successfully imported $total_count personas into $RULES_DIR"
