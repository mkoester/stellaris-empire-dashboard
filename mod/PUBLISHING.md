# Publishing the companion mod

Store copy and checklist for **Empire Dashboard Feed** (`dashboard_feed/`). Both stores are
uploaded to from the **Paradox Launcher** (Mod Tools → "Upload Mod"), not the Steam SDK —
`stellaris-modding-insights/docs/08-publishing-workshop-and-paradox-mods.md` has the gotchas.

The shippable mod is the `dashboard_feed/` folder; this file and `assets/` (the thumbnail's
source, `thumbnail.svg`, rendered with `rsvg-convert -w 512 -h 512 assets/thumbnail.svg -o
dashboard_feed/thumbnail.png`) stay out of the upload.

## Checklist

- [x] `version` in `descriptor.mod` bumped for every upload (and the log format, `SDASH|<n>|`,
      changed only together with `feed.ts` — see `docs/companion-mod.md`).
- [ ] **Upload from `main`'s content only**, never from `open-beta` or a feature worktree: there is
      one item per store for every player, so a beta-only mod would reach the public game too.
- [ ] Every open check for the version's new mod features has passed (`docs/open-checks.md`) —
      0.10.0 went up with `num_sapient_pops` still broken (open check 23); the fix shipped as
      0.10.1.
- [ ] The folder holds only `descriptor.mod`, `thumbnail.png`, `common/`, `events/` (`ls -A`) — the launcher
      uploads everything in it (0.10.0 shipped an empty `.claude/` left by a Claude Code session).
- [x] `picture="thumbnail.png"`, 512×512 PNG, our own art (no game art).
- [x] Launcher closed → `scripts/link-mod.sh stellaris-empire-dashboard/mod/dashboard_feed` (from the
      workspace root; the link may point at a worktree after `scripts/dashboard.sh --beta`) →
      launcher open, the mod listed. On Linux the upload dialog may not see a
      **symlinked** mod: then copy the folder into `<user dir>/mod/` and upload that copy.
- [x] Upload to **Steam Workshop** (description: BBCode below). The launcher writes
      `remote_file_id` into `descriptor.mod` — with the symlink into this repo, so commit it; with
      a copy, copy the line back. Keep it: it makes later uploads update the same item.
- [x] Upload to **Paradox Mods** (description: plain text below, then format it with the
      website's editor; it is not Markdown). Its id is in `launcher-v2.sqlite` (`mods.remotePdxId`)
      only — note it under "Published IDs".
- [x] Links in `release/README.txt` and the dashboard's `README.md`.

## Published IDs

| Store          | Item ID      | URL                                                               |
| -------------- | ------------ | ----------------------------------------------------------------- |
| Steam Workshop | `3826360023` | https://steamcommunity.com/sharedfiles/filedetails/?id=3826360023 |
| Paradox Mods   | `164724`     | https://mods.paradoxplaza.com/mods/164724/Any                     |

First uploaded 2026-10-24 (0.5.0). `remote_file_id` (Steam) is in `descriptor.mod`; the Paradox
id only in the launcher's DB (`mods.remotePdxId`). **A first Workshop upload is Hidden**: set the
visibility to Public on the item's page (Owner Controls) — the launcher does not. **The first upload
from another machine made a new item** (2026-11-17: `3841118861`, deleted; why is unknown): after
uploading from a machine for the first time, check `remote_file_id` is still `3826360023`.

**0.10.1, 2026-11-01 08:40 UTC, from `develop`** — an exception to "upload from `main`" (the user's
call: `develop` differed from `main` only in the mod and docs, not worth a dashboard release);
`main` catches up at the next release. Replaces 0.10.0 (2026-10-31), whose `colony-jobs` lines
were empty and colony event failed on arkships. Paradox Mods: version 4 (`latestUpdate` in
`https://api.paradox-interactive.com/mods?modId=164724&os=Linux`, which also lists each version).
**The upload strips `descriptor.mod`'s final newline**: harmless, restore it or commit it.

**0.11.0, 2026-11-04 14:20 UTC, from `main`** (dashboard 0.1.9) — the monthly `multiplayer` line,
seen in game first (open check 27). Paradox Mods: version 5.

## Store description

`store/dashboard_feed.bbcode` is the Steam Workshop text (BBCode). `scripts/store_texts.py` in the workspace (run by `slink`, or on its own with the launcher closed) writes it into the launcher's upload form, with the "More from me" block appended, and makes the Paradox Mods HTML and short description from it. Edit the file, never the form.
