# Profile sync

Add the GitHub topic `profile-featured` to each public repository you want to feature. Remove it or make the repository private to remove the card on the next successful run. The profile repository cannot feature itself. Nothing is automatically opted in.

The profile's [sync workflow](../.github/workflows/sync-profile.yml) runs about every 30 minutes, on relevant pushes to `main`, or via **Actions > Sync featured projects > Run workflow**. Scheduled runs can be delayed by GitHub, and scheduled workflows in inactive public repositories can be disabled after 60 days of no repository activity. Re-enable the workflow from Actions if needed.

The script uses the public account and owner-repositories APIs. The heading shows public repository and follower counts. For selected public projects, it shows the name, public About description, stars, forks, and latest push date (UTC); the language block shows up to eight languages by share of GitHub-reported bytes across those projects. The percentages use all detected language bytes as their denominator. With no selected projects, the entire project and language section is hidden. The script does not copy project READMEs or infer profile text. Edit personal text and confirmed contact links outside the generated markers; the workflow preserves them. No stored secret is required; the workflow uses its repository token. Git history can retain previously published figures, names, or descriptions.

`MY TECH STACK` uses only the explicitly configured labels in [`tech-stack.json`](tech-stack.json). Put personal favorites in `favorites` and grouped labels in `other`. The gray Shields.io badges appear only for nonempty groups; the other technologies list is collapsed by default. No labels are inferred from repositories.

For older README layouts, the public sync can generate `FUN FACTS` from recent public pushes. The current layout uses an independent aggregate block instead; the Actions workflow leaves that block untouched and never uses a credential with access to private repositories.

## Refresh aggregate charts

From the repository root, run `node tools/owned-stats.mjs dmechai` with `gh` authenticated as the profile owner and able to read the intended private repositories. Review the generated README change before committing it. The command does not push or log API payloads. Only aggregate counts and percentages go into the README: no repository names, links, IDs, or per-repository breakdowns. Publishing the totals makes them public and Git history can retain earlier totals.

The charts use owned repositories visible to the login, excluding forks and this profile. Commit counts cover the last 90 UTC calendar days and reflect commits GitHub attributes to the account, not all local commits or all branch activity. The language chart counts each repository once by its GitHub-detected primary language; repositories without a detected language are excluded. These aggregates do not populate technical preferences or Featured Projects. The aggregate refresh is currently manual; the public Actions schedule still updates the other blocks.

Run tests with `node --test tools/*.test.mjs`. To refresh locally, use an authenticated `gh` CLI and run `gh api --paginate 'users/dmechai/repos?type=owner&per_page=100' | jq -s . | node tools/sync-profile.mjs dmechai` from the repository root. The command rewrites only the generated blocks in `README.md`. If an API request fails, it leaves the previous README unchanged.
