# Releasing

`main` carries releases, `develop` the next one; every release is a `--no-ff` merge into `main`,
tagged `vX.Y.Z` (the OKF vault's procedure, `practices/git-and-workspaces.md`). `develop` already
carries the version being released (`package.json`). **Pushing the tag publishes the release**:
`.github/workflows/release.yml` checks the tag is on `main` and matches `package.json`, tests,
builds the zips (Windows, Linux, macOS arm64 and x64) and creates the GitHub release with this
version's `CHANGELOG.md` section.

1. **Extractor first**: the zips bundle `stellaris-data-extraction` at the tag `package.json`
   pins (`extractorVersion`), and a release build refuses any other. If the extractor changed,
   release it, then set `extractorVersion` to its new tag.
2. On `develop`, everything committed: in `CHANGELOG.md`, turn `Unreleased` into
   `## [X.Y.Z] - <date>` (own commit) — the release notes come from that section.
3. `git checkout main && git merge --no-ff develop -m "Release vX.Y.Z (merge develop)"`, then
   `git tag vX.Y.Z`.
4. Optional, before pushing: `node scripts/package.mjs --os linux` on that clean `main` and a smoke
   test (unzip into a temp dir, `XDG_DATA_HOME=<temp> ./start.sh`, pick the folders, open a few
   tabs). **The extractor's checkout must sit on the pinned tag** — the tag existing is not enough
   (`… is on no tag` while it is on `develop`): check out `vX.Y.Z` in
   `../stellaris-data-extraction` for the build, back to `develop` after. To skip `/setup` (e.g. driving it with `curl`),
   write `<temp>/stellaris-empire-dashboard/config.json` = `{"gameDir": …, "userDir": …}` first and
   start with `BROWSER=true`; the launcher prints its URL (checked 2026-10-31 for v0.1.4). The Windows zip on a Windows machine, the Mac zip for its architecture on a Mac (copy a few
   saves over; the game need not run there), when the launcher or packaging changed.
5. `git checkout develop`, bump the patch in `package.json`, commit `chore: version bump (vX.Y.Z+1)`.
6. Publish (by hand): `git push origin main develop`, then `git push origin vX.Y.Z` — the workflow
   does the rest (Actions tab). A failed run leaves no release: fix, move the tag only if it was
   never published (`git tag -f`, `git push -f origin vX.Y.Z`), or release the next patch.

## Beta build (a game's open beta)

For players on Steam's `stellaris_test` branch, when the dashboard needs a change before the game
patch is out. A **prerelease** from `develop`: no merge into `main`, no `CHANGELOG` heading — the
release notes are its `Unreleased` section.

1. **Extractor first**, as above: it reads the beta and the current release alike, so it gets a
   normal release; pin its tag in `extractorVersion` on `develop`.
2. On `develop`, everything committed: `git tag vX.Y.Z-beta.N` (X.Y.Z = `package.json`'s version,
   N counting from 1). The zips are named `…-X.Y.Z-beta.N-…` and a beta build refuses an
   unpinned extractor just like a release.
3. Publish (by hand): `git push origin develop`, then `git push origin vX.Y.Z-beta.N`. The workflow
   checks the tag is on `develop`, and marks the GitHub release a prerelease (not "Latest").
4. When the game patch goes live: the normal release above. No version bump is needed after a
   beta tag.
