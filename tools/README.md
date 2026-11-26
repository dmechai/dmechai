# Profile README maintenance

Edit `README.md` directly for the introduction, contact links, technology list, and featured projects. This repository must remain public and named `dmechai` for GitHub to display it on the profile. No CMS is required.

The `Refresh contribution snake` workflow runs daily at 04:28 UTC or via **Run workflow**. It regenerates both themes from the contribution calendar visible to its repository token, removes the progress bar with `strip-snake-progress.mjs`, and commits only the two SVGs. GitHub may delay scheduled runs. Run `node --test tools/*.test.mjs` to check the SVG cleanup.
