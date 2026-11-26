# GitHub profile publishing

## Edit the profile

Open https://app.pagescms.org/dmechai/dmechai/main and sign in with GitHub. Grant the Pages CMS installation access to `dmechai/dmechai` if it is not listed. In **GitHub 主页**, enter public contact links and select the projects to feature. In **技术标签**, enter any preferred or other technologies. Saving commits the settings to `main` and triggers publication. The settings are in a public repository: never enter private links, credentials, or an address you do not want published.

Featured Projects is opt-in and public-only. The workflow refreshes available choices and rechecks repository visibility before rendering. It publishes each selected repository's About text, stars, forks and latest push date (UTC), plus language byte shares across the selection. Empty sections stay hidden. Repository topics are not needed for the CMS selection. The workflow also refreshes public account counts and generates light and dark contribution snakes with [Platane/snk](https://github.com/Platane/snk), using the contribution calendar visible to the workflow token.

The [public workflow](../.github/workflows/sync-profile.yml) runs on relevant pushes, about every 30 minutes, and via **Actions > Sync GitHub profile > Run workflow**. GitHub can delay schedules or disable them after extended inactivity. It has no private-repository credential.

## Private aggregate refresh

The host timer `dmechai-profile-stats.timer` runs daily at 04:08 UTC. The service expects `gh` authenticated as `dmechai` with read access to the intended repositories and write access to the public profile README. It uses the host credential, not Actions secrets. Deploy `publish-owned-stats.sh`, `owned-stats.mjs`, and `sync-profile.mjs` together to `/usr/local/libexec/dmechai-profile`, and install the matching service and timer in `/etc/systemd/system`. Run `systemctl start dmechai-profile-stats.service` for an immediate refresh. The publisher only replaces the aggregate block, checks the previous file SHA when writing, and retries if a concurrent edit wins. No raw API data is published.

The charts use owned repositories visible to the login, excluding forks and this profile. Commit contributions cover the last 90 UTC calendar days and are limited to commits GitHub attributes to the account. The language chart counts each repository once by its detected primary language. Only aggregate counts and percentages are published; Git history can retain old totals. Disable the timer with `systemctl disable --now dmechai-profile-stats.timer` to stop future aggregate publication.

For a local refresh without publishing, run `node tools/owned-stats.mjs dmechai` from the repository root with the appropriate GitHub login. Run tests with `node --test tools/*.test.mjs`.
