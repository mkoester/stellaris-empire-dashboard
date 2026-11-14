# Packaging

What a zip per OS holds, the launcher, stopping, the version. Read before changing `scripts/package.mjs`, `release/` or the release workflow; the release steps themselves are in `RELEASE.md`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

`node scripts/package.mjs [--os windows|linux|macos]` →
`dist/stellaris-empire-dashboard-<version>-<os>-<arch>.zip` (`windows-x64`, `linux-x64`,
`macos-arm64`, `macos-x64`): the build plus `jomini` (the only external import left in the build),
Node 26 (pinned, SHA-256 from nodejs.org; it needs macOS 13.5+, and Intel Macs are Tier 2 until early 2028), the extractor from
`../stellaris-data-extraction` by `git archive HEAD` (a release build refuses one that is not on
the tag `package.json` pins as `extractorVersion`), Python where the system has none recent
enough, and `release/`: `launcher.mjs`, `start.bat` / `start.command` / `start.sh` (checks
`python3 ≥ 3.10`), `README.txt` for players — **its "Where things are" is the list of every
folder for players**; a new discovery path in `locate.ts` goes there too.

- **Windows**: Python's embeddable package (pinned, SHA-256 from python.org's release API; its
  `._pth` gets `..\extractor`).
- **macOS**: python-build-standalone's `install_only_stripped` CPython (pinned release and
  SHA-256 from its GitHub release assets), the same version as Windows'. Apple ships only 3.9
  with the Command Line Tools. The interpreter is static, so `libpython`, Tcl/Tk, pip, headers
  and `lib-dynload` (only `_tkinter`, `_dbm`) are pruned (69 → 53 MB zip). Checked 2026-10-22
  with the same prune of the release's _Linux_ build here: a full extraction, 281 civics and 77
  origins. Zips store symlinks as symlinks (`zip -y`: `python3 → python3.14`). `start.command`
  clears the quarantine mark on its own folder (`xattr -dr com.apple.quarantine .`) once the
  player has allowed it in Privacy & Security; the bundled Python is not notarized, Node is.
  **The Mac zips have not run on a Mac yet** — first run per `RELEASE.md`.
  Downloads are cached in `.cache/`. **In the Claude Code sandbox** Node's `fetch` needs
  `NODE_USE_ENV_PROXY=1` to reach nodejs.org (it ignores the proxy otherwise: `EAI_AGAIN`), and
  the command must name `nodejs.org` among its allowed hosts — a clone in `$TMPDIR` has no `.cache/`
  and downloads Node (2026-11-12).

**`launcher.mjs` serves the app through its own HTTP server**, not adapter-node's `index.js`:
without `ORIGIN` adapter-node 6 takes every request for `https`, and SvelteKit rejects the forms
(`/setup`, `/timeline`) as `Cross-site POST form submissions are forbidden` — only on the built
app, `pnpm dev` never shows it. It marks each request `http` in a header named by `PROTOCOL_HEADER`,
so 127.0.0.1, localhost and a LAN address (`--lan`) all work, and a foreign origin is still refused.

**Stopping** (Ctrl+C, a closed window — SIGHUP on Windows, macOS and Linux — or a kill): the
launcher closes its server and every connection (the event stream never goes idle), then emits
adapter-node's `sveltekit:shutdown`; `stop()` in `app.ts` waits for a start-up and the save being
read, stops the game.log tail and closes the DB, which folds the WAL back. Nothing keeps the
process alive after that; it gives up after 5 s (Windows kills a closed console ~10 s later), a
second Ctrl+C exits at once. A stop during start-up never serves. Checked 2026-10-25 on Linux with
a built app and a DB copy (SIGINT/HUP/TERM: exit 0 in ~15 ms, no `-wal` left; the old launcher:
exit 130, `-wal` left). **Not yet seen on Windows or a Mac.** `pnpm dev` is Vite's, unaffected.

The version in the header and the zip names is `scripts/version.mjs` (decorated with git state;
a commit tagged `v<version>` counts as a release, since CI builds from the detached tag).
Releasing: `RELEASE.md` — pushing a `vX.Y.Z` tag on `main` runs `.github/workflows/release.yml`,
which checks out the extractor at `extractorVersion` next to the dashboard, tests, packages and
creates the GitHub release with both zips and the `CHANGELOG.md` section as notes. A
`vX.Y.Z-rc.N` tag on `develop` (a release candidate, "X.Y.Z rc-N") and a `vX.Y.Z-beta.N` tag on
`open-beta` (the branch for a running open beta, "X.Y.Z vN (for Open Beta <openBeta>)", from
`package.json`'s `openBeta`) do the same as GitHub prereleases, their notes the `Unreleased`
section (`RELEASE.md`, "Three kinds of build"). The Windows zip
ran on a real Windows machine (2026-10-25, the user); Wine cannot start in the sandbox
(`wineserver` needs a writable `/tmp`).
