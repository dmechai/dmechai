#!/usr/bin/env bash
set -euo pipefail
umask 077
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
owner=$(gh api user --jq .login)
[[ "$owner" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*$ ]] || exit 1
profile="$owner/$owner"
actual=$(gh api "repos/$profile" --jq 'select(.private == false and .fork == false) | .full_name')
if [[ "$actual" != "$profile" ]]; then
  printf 'Expected a public, non-fork profile repository at %s.\n' "$profile" >&2
  exit 1
fi
gh repo clone "$profile" "$work/profile" -- --quiet --depth=1 --branch main
cd -- "$work/profile"
for attempt in 1 2 3; do
  node "$script_dir/owned-stats.mjs" "$owner"
  git add -- README.md assets/snake.svg assets/snake-dark.svg
  if git diff --cached --quiet; then exit 0; fi
  git -c user.name="$owner" -c user.email="$owner@users.noreply.github.com" commit --quiet -m 'Refresh aggregate profile charts'
  if git push origin HEAD:main; then exit 0; fi
  if [[ "$attempt" == 3 ]]; then exit 1; fi
  git fetch --quiet --depth=1 origin main
  git switch --quiet --detach FETCH_HEAD
done
