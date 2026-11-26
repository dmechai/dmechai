# Profile README maintenance

Edit `README.md` directly for the introduction, contact links, technology list, and featured projects. This repository must remain public and named `dmechai` for GitHub to display it on the profile. No CMS is required.

The host timer `dmechai-profile-stats.timer` runs daily at 04:08 UTC. It requires `gh` authenticated as `dmechai` with read access to the intended repositories and write access to this public README. It publishes only aggregate counts and percentages in the `fun-facts` block, retrying on concurrent edits. It does not publish repository names, links, IDs, or per-repository activity. Counts cover all commits reachable from current branches, deduplicated within each repository, and each repository's detected primary language. Forks and this repository are excluded. Empty datasets retain a no-data message. Publishing totals makes them public, and Git history can retain old totals.

Install `owned-stats.mjs` and `publish-owned-stats.sh` in `/usr/local/libexec/dmechai-profile` and the matching unit files in `/etc/systemd/system`. Reload systemd and enable the timer. Run `systemctl start dmechai-profile-stats.service` for an immediate refresh.

The `Refresh contribution snake` workflow runs daily at 04:28 UTC or via **Run workflow**. It regenerates both themes from the contribution calendar visible to its repository token, removes the progress bar with `strip-snake-progress.mjs`, and commits only the two SVGs. GitHub may delay scheduled runs. Run `node --test tools/*.test.mjs` to check the SVG cleanup.
