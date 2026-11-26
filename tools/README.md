# README maintenance

Edit `README.md` directly for the introduction, contact links, technology list, and featured projects. Keep the `owned-stats` markers intact. This repository stays private and does not publish a GitHub profile README. No CMS is required.

## Automatic refresh

The host timer `dmechai-profile-stats.timer` runs daily at 04:08 UTC. It requires `gh` authenticated as `dmechai` with read access to the intended repositories and write access to this private README. It publishes only aggregate statistics and updates only the marked block, retrying on concurrent edits. It refuses to publish if the target repository is not private. Commit counts cover 90 UTC calendar days of GitHub-attributed contributions; language counts use each repository's detected primary language. Forks and this repository are excluded. When a dataset is empty, the chart heading stays visible with a no-data message.

Install `owned-stats.mjs` and `publish-owned-stats.sh` in `/usr/local/libexec/dmechai-profile` and the matching unit files in `/etc/systemd/system`. Reload systemd and enable the timer. Run `systemctl start dmechai-profile-stats.service` for an immediate refresh.

The `Refresh contribution snake` GitHub Actions workflow runs daily at 04:28 UTC or via **Run workflow**. It regenerates both themes from the contribution calendar visible to its repository token, removes the progress bar with `strip-snake-progress.mjs`, and commits only the two SVGs. It does not use the host credential or rewrite the README. GitHub may delay scheduled runs.

Run `node --test tools/*.test.mjs` to check rendering and filtering.
