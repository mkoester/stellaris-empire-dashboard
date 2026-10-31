# Releasing

`main` carries releases, `develop` the next one; every release is a `--no-ff` merge into `main`,
tagged `vX.Y.Z` (the OKF vault's procedure, `practices/git-and-workspaces.md`). `develop` already
carries the version being released (`package.json`). **Pushing the tag publishes the release**:
`.github/workflows/release.yml` checks the tag is on `main` and matches `package.json`, tests,
builds the zips (Windows, Linux, macOS arm64 and x64) and creates the GitHub release with this
version's `CHANGELOG.md` section.

1. **Extractor first**: the zips bundle `stellaris-data-extraction` at the tag `package.json`
   pins (`extractorVersion`), and a release build refuses any other. If the extractor changed,
   release it, then set `extractorVersion` to its new tag. For a `vX.Y.Z` the workflow runs that
   tag's `scripts/release-check` and fails on a stale dump or one from a game beta (prereleases
   skip it); tags before v0.1.6 have no such script, so pin a newer one.
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

## Three kinds of build, by branch

Each is a tag the workflow builds and publishes; the title is the release's name on GitHub.

| Branch      | Tag             | Release title                                         | Notes from        |
| ----------- | --------------- | ----------------------------------------------------- | ----------------- |
| `main`      | `vX.Y.Z`        | Stellaris Empire Dashboard X.Y.Z                      | `## [X.Y.Z]`      |
| `develop`   | `vX.Y.Z-rc.N`   | Stellaris Empire Dashboard X.Y.Z rc-N (prerelease)    | `## [Unreleased]` |
| `open-beta` | `vX.Y.Z-beta.N` | Stellaris Empire Dashboard X.Y.Z vN (for Open Beta B) | `## [Unreleased]` |

Every release's notes open with the game it was built for (`scripts/game-version.sh`): a beta
build's `openBeta`, else the bundled extractor's `sql/stellaris.sql` `meta.game_version` ("Built for
Stellaris Cygnus v4.5.2 (9776).").

X.Y.Z is always `package.json`'s version, N counts from 1 per X.Y.Z, B is `package.json`'s
`openBeta` (the game's beta version, e.g. `4.5.3`; set on `open-beta` only — a beta tag without it
fails). The workflow refuses a tag that is not on its branch or does not match the version. Every
kind bundles exactly the pinned extractor (`extractorVersion`), so a build needing unreleased
extractor work needs an extractor tag first.

## Release candidate (from `develop`)

A build for testers before a release: no merge, no `CHANGELOG` heading, no version bump.

1. **Extractor**: `extractorVersion` must name a tag (`develop` needing unreleased extractor work:
   release the extractor first).
2. On `develop`, everything committed: `git tag vX.Y.Z-rc.N`.
3. Publish (by hand): `git push origin develop`, then `git push origin vX.Y.Z-rc.N` — a GitHub
   prerelease (not "Latest"), zips named `…-X.Y.Z-rc.N-…`.

## Beta build (a game's open beta)

For players on Steam's `stellaris_test` branch. Work specifically for a running open beta lives on
the branch **`open-beta`** (cut from `develop`, `develop` merged in as needed); its builds are
**prereleases** tagged there: no merge into `main`, no `CHANGELOG` heading — the release notes are
its `Unreleased` section.

1. **Extractor first**: a beta tag on its `open-beta` (its `RELEASE.md`), unless the beta needs no
   extractor change; pin that tag in `extractorVersion` on `open-beta`.
2. On `open-beta`, once per beta: `"openBeta": "4.5.3"` in `package.json` (the game's beta
   version, as the release title shows it), committed.
3. On `open-beta`, everything committed: `git tag vX.Y.Z-beta.N` (X.Y.Z = `package.json`'s
   version, N counting from 1). The zips are named `…-X.Y.Z-beta.N-…` and a beta build refuses an
   unpinned extractor just like a release.
4. Publish (by hand): `git push origin open-beta`, then `git push origin vX.Y.Z-beta.N`. The
   workflow checks the tag is on `open-beta`, and marks the GitHub release a prerelease (not
   "Latest"), titled "Stellaris Empire Dashboard X.Y.Z vN (for Open Beta 4.5.3)".
5. When the game patch goes live: `git checkout develop && git merge --no-ff open-beta`, drop
   `openBeta` from `package.json`, the extractor's release pinned again (a `vX.Y.Z` tag, not a
   beta one), then the normal release above; delete `open-beta` (local and remote) once released.
   No version bump after a beta tag.
