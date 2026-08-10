#!/usr/bin/env bash
# deploy.sh — gates -> fresh build -> firebase hosting deploy -> smoke test.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "========================================"
echo "=== [1/4] Running gates (./gate.sh) ==="
echo "========================================"
if ! ./gate.sh; then
  echo "FAIL: gates failed — deploy aborted"
  exit 1
fi

echo ""
echo "========================================"
echo "=== [2/4] Fresh build ==="
echo "========================================"
npm run build || { echo "FAIL: build failed — deploy aborted"; exit 1; }

echo ""
echo "========================================"
echo "=== [3/4] Firebase deploy (hosting) ==="
echo "========================================"
firebase deploy --only hosting || { echo "FAIL: firebase deploy failed"; exit 1; }

echo ""
echo "========================================"
echo "=== [4/4] Smoke test ==="
echo "========================================"
status=$(curl -s -o /tmp/presift_index.html -w '%{http_code}' https://presift.web.app/)
echo "HTTP status: ${status}"

href=$(grep -o 'assets/index-[^"]*\.js' /tmp/presift_index.html | head -1)
if [ -z "$href" ]; then
  echo "FAIL: no JS asset href found in deployed index.html"
  exit 1
fi
echo "Remote asset: ${href}"

curl -s -o /tmp/presift_remote.js "https://presift.web.app/${href}"
remote_md5=$(md5sum /tmp/presift_remote.js | awk '{print $1}')

local_file="dist/${href}"
if [ -f "$local_file" ]; then
  local_md5=$(md5sum "$local_file" | awk '{print $1}')
else
  local_md5="(no local match for ${href})"
fi

echo "Remote md5: ${remote_md5}"
echo "Local  md5: ${local_md5}"

if [ "$local_md5" = "$remote_md5" ]; then
  echo "PASS: deployed JS asset matches fresh local build"
else
  echo "WARN: deployed JS asset differs from local — likely CDN cache lag"
fi
