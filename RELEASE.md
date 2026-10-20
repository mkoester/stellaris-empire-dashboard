# Releasing

`main` carries releases, `develop` the next one; every release is a `--no-ff` merge into `main`,
tagged `vX.Y.Z` (the OKF vault's procedure, `practices/git-and-workspaces.md`). `develop` already
carries the version being released (`package.json`).

1. **Extractor first**: the zips bundle `../stellaris-data-extraction` as committed, and a release
   build refuses one that is not on a tag — release it first if it changed.
2. On `develop`, everything committed: in `CHANGELOG.md`, turn `Unreleased` into
   `## [X.Y.Z] - <date>` (own commit).
3. `git checkout main && git merge --no-ff develop -m "Release vX.Y.Z (merge develop)"`, then
   `git tag vX.Y.Z`.
4. `node scripts/package.mjs` on that clean `main` → `dist/…-X.Y.Z-windows-x64.zip` and
   `…-linux-x64.zip`; their names carry the plain version (a `-<hash>` or `-SNAPSHOT` means the
   tree was not a clean `main`).
5. Smoke test the Linux zip: unzip into a temp dir, `XDG_DATA_HOME=<temp> ./start.sh`, pick the
   folders, open a few tabs. The Windows zip on a Windows machine when the launcher or packaging
   changed.
6. `git checkout develop`, bump the patch in `package.json`, commit `chore: version bump (vX.Y.Z+1)`.
7. Publish (by hand): `git push origin main develop --tags`, then
   `gh release create vX.Y.Z dist/*.zip --title vX.Y.Z --notes "<the CHANGELOG section>"`.
