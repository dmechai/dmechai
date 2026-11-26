# Profile sync

Add the GitHub topic `profile-featured` to each public repository you want to feature. Remove it or make the repository private to remove the card on the next successful run. The profile repository cannot feature itself. Nothing is automatically opted in.

The profile's [sync workflow](../.github/workflows/sync-profile.yml) runs about every 30 minutes, on relevant pushes to `main`, or via **Actions > Sync featured projects > Run workflow**. Scheduled runs can be delayed by GitHub, and scheduled workflows in inactive public repositories can be disabled after 60 days of no repository activity. Re-enable the workflow from Actions if needed.

The script uses the public owner-repositories API, checks visibility again, and displays each selected repo's name, public About description, and last push date (UTC). It doesn't copy project README contents, read private repos, or infer profile text. Push script updates to GitHub for the date to change; local edits do not count. Keep About descriptions updated when the project's purpose changes. Edit profile text outside the generated markers; the workflow preserves it. No stored secret is required; the workflow uses a repository-scoped token to update its own README. GitHub history can still contain project names or descriptions already published by an earlier sync.

Run tests with `node --test tools/sync-profile.test.mjs`. To preview locally, save your work first and run `gh api --paginate 'users/dmechai/repos?type=owner&per_page=100' | jq -s . | node tools/sync-profile.mjs dmechai` from the repository root. The preview rewrites only the marked block in the local README.
