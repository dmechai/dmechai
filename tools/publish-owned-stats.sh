#!/usr/bin/env bash
set -euo pipefail
umask 077
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
gh repo clone dmechai/dmechai "$work/profile" -- --quiet --depth=1 --branch main
cd -- "$work/profile"
for attempt in 1 2 3; do
  node "$script_dir/owned-stats.mjs" dmechai
  git add -- README.md assets/snake.svg assets/snake-dark.svg
  if git diff --cached --quiet; then exit 0; fi
  git -c user.name='dmechai' -c user.email='dmechai@users.noreply.github.com' commit --quiet -m 'Refresh aggregate profile charts'
  if git push origin HEAD:main; then exit 0; fi
  if [[ "$attempt" == 3 ]]; then exit 1; fi
  git fetch --quiet --depth=1 origin main
  git switch --quiet --detach FETCH_HEAD
done
