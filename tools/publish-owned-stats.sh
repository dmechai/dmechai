#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
repo='repos/dmechai/dmechai'
for attempt in 1 2 3; do
  gh api "$repo/git/ref/heads/main" > "$work/ref.json"
  base=$(jq -er '.object.sha' "$work/ref.json")
  gh api "$repo/git/trees/$base" > "$work/tree.json"
  readme_sha=$(jq -er '.tree[] | select(.path=="README.md") | .sha' "$work/tree.json")
  light_sha=$(jq -er '.tree[] | select(.path=="assets/snake.svg") | .sha' "$work/tree.json")
  dark_sha=$(jq -er '.tree[] | select(.path=="assets/snake-dark.svg") | .sha' "$work/tree.json")
  gh api "$repo/git/blobs/$readme_sha" > "$work/readme.json"
  jq -er '.content' "$work/readme.json" | base64 --decode > "$work/before.md"
  cp -- "$work/before.md" "$work/README.md"
  mkdir -p assets
  gh api "$repo/contents/assets/snake.svg?ref=main" > "$work/light.json"
  gh api "$repo/contents/assets/snake-dark.svg?ref=main" > "$work/dark.json"
  jq -er '.content' "$work/light.json" | base64 --decode > assets/snake.svg
  jq -er '.content' "$work/dark.json" | base64 --decode > assets/snake-dark.svg
  cp assets/snake.svg "$work/snake-before.svg"
  cp assets/snake-dark.svg "$work/snake-dark-before.svg"
  node owned-stats.mjs dmechai "$work/README.md"
  if cmp -s "$work/before.md" "$work/README.md" && cmp -s assets/snake.svg "$work/snake-before.svg" && cmp -s assets/snake-dark.svg "$work/snake-dark-before.svg"; then exit 0; fi
  readme_blob=$(base64 -w0 "$work/README.md" | jq -Rs '{content:.,encoding:"base64"}' | gh api --method POST "$repo/git/blobs" --input - --jq .sha)
  light_blob=$(base64 -w0 assets/snake.svg | jq -Rs '{content:.,encoding:"base64"}' | gh api --method POST "$repo/git/blobs" --input - --jq .sha)
  dark_blob=$(base64 -w0 assets/snake-dark.svg | jq -Rs '{content:.,encoding:"base64"}' | gh api --method POST "$repo/git/blobs" --input - --jq .sha)
  jq -n --arg base "$base" --arg readme "$readme_blob" --arg light "$light_blob" --arg dark "$dark_blob" \
    '{base_tree:$base,tree:[{path:"README.md",mode:"100644",type:"blob",sha:$readme},{path:"assets/snake.svg",mode:"100644",type:"blob",sha:$light},{path:"assets/snake-dark.svg",mode:"100644",type:"blob",sha:$dark}]}' > "$work/new-tree.json"
  tree=$(gh api --method POST "$repo/git/trees" --input "$work/new-tree.json" --jq .sha)
  jq -n --arg tree "$tree" --arg parent "$base" '{message:"Refresh aggregate profile charts",tree:$tree,parents:[$parent]}' > "$work/commit.json"
  commit=$(gh api --method POST "$repo/git/commits" --input "$work/commit.json" --jq .sha)
  if jq -n --arg sha "$commit" '{sha:$sha}' | gh api --method PATCH "$repo/git/refs/heads/main" --input - > /dev/null; then exit 0; fi
  sleep 3
done
exit 1
