#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
endpoint='repos/dmechai/dmechai/contents/README.md'
for attempt in 1 2 3; do
  gh api "$endpoint?ref=main" > "$work/source.json"
  jq -er '.content' "$work/source.json" | base64 --decode > "$work/before.md"
  cp -- "$work/before.md" "$work/README.md"
  node owned-stats.mjs dmechai "$work/README.md"
  if cmp -s "$work/before.md" "$work/README.md"; then exit 0; fi
  sha=$(jq -er '.sha' "$work/source.json")
  base64 -w0 "$work/README.md" | jq -Rs --arg sha "$sha" \
    '{sha:$sha,branch:"main",message:"Refresh aggregate profile charts",content:.}' > "$work/update.json"
  if gh api --method PUT "$endpoint" --input "$work/update.json" > /dev/null; then exit 0; fi
  sleep 3
done
exit 1
