# Publishing the companion mod

Store copy and checklist for **Empire Dashboard Feed** (`dashboard_feed/`). Both stores are
uploaded to from the **Paradox Launcher** (Mod Tools → "Upload Mod"), not the Steam SDK —
`stellaris-modding-insights/docs/08-publishing-workshop-and-paradox-mods.md` has the gotchas.

The shippable mod is the `dashboard_feed/` folder; this file and `assets/` (the thumbnail's
source, `thumbnail.svg`, rendered with `rsvg-convert -w 512 -h 512 assets/thumbnail.svg -o
dashboard_feed/thumbnail.png`) stay out of the upload.

## Checklist

- [x] `version` in `descriptor.mod` bumped for every upload (and the log format, `SDASH|<n>|`,
      changed only together with `feed.ts` — see `AGENTS.md` → Companion mod).
- [x] `picture="thumbnail.png"`, 512×512 PNG, our own art (no game art).
- [x] Launcher closed → `scripts/link-mod.sh stellaris-empire-dashboard/mod/dashboard_feed` (from the
      workspace root) → launcher open, the mod listed. On Linux the upload dialog may not see a
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
visibility to Public on the item's page (Owner Controls) — the launcher does not.

## Store description — Steam Workshop (BBCode)

```bbcode
[h1]Empire Dashboard Feed[/h1]

The companion mod for the [url=https://github.com/mkoester/stellaris-empire-dashboard]Stellaris Empire Dashboard[/url]: a free, open-source second screen for your running game — your empire at a glance and its history over time, read from your autosaves.

[b]On its own this mod does nothing you can see.[/b] It writes a few numbers into the game's log and saves that the dashboard reads; get the dashboard (Windows, macOS, Linux) from its [url=https://github.com/mkoester/stellaris-empire-dashboard/releases]releases page[/url].

[h2]What it adds to the dashboard[/h2]
[list]
[*][b]Daily stockpiles[/b] — not just at each autosave.
[*][b]Exact reload branches[/b] — which save you loaded, so going back in time starts the right branch instead of a guess.
[*][b]Events as they happen[/b] — colonies, wars, battles, leader deaths, new rulers, spending.
[*][b]Values the game does not save[/b] — your storage and other empires', and Galactic Community voting weight; without the mod the dashboard estimates them (marked ≈).
[/list]
The dashboard works fully without the mod; this makes it exact and live.

[h2]How it works[/h2]
Hidden events only: once a month (and a light daily tick) it writes lines to [i]logs/game.log[/i] and stores a few country variables in your save. It changes no vanilla file, no UI, no balance.

[h2]Compatibility[/h2]
[list]
[*]Built for Stellaris 4.5.x (supported version v4.5.*, tested on 4.5.2).
[*]Compatible with practically everything — it overrides nothing.
[*]Can be enabled in a running game: it starts with the next load.
[/list]

[h2]⚠ Not Ironman / achievement compatible[/h2]
Like every script mod, it changes the checksum: achievements and Ironman are off while it is enabled.

Unofficial fan project, not affiliated with Paradox Interactive.
```

## Store description — Paradox Mods (plain text; format with the website's editor)

```text
Empire Dashboard Feed

The companion mod for the Stellaris Empire Dashboard (https://github.com/mkoester/stellaris-empire-dashboard): a free, open-source second screen for your running game — your empire at a glance and its history over time, read from your autosaves.

On its own this mod does nothing you can see. It writes a few numbers into the game's log and saves that the dashboard reads; get the dashboard (Windows, macOS, Linux) from https://github.com/mkoester/stellaris-empire-dashboard/releases

What it adds to the dashboard
• Daily stockpiles — not just at each autosave.
• Exact reload branches — which save you loaded, so going back in time starts the right branch instead of a guess.
• Events as they happen — colonies, wars, battles, leader deaths, new rulers, spending.
• Values the game does not save — your storage and other empires', and Galactic Community voting weight; without the mod the dashboard estimates them (marked ≈).
The dashboard works fully without the mod; this makes it exact and live.

How it works
Hidden events only: once a month (and a light daily tick) it writes lines to logs/game.log and stores a few country variables in your save. It changes no vanilla file, no UI, no balance.

Compatibility
• Built for Stellaris 4.5.x (supported version v4.5.*, tested on 4.5.2).
• Compatible with practically everything — it overrides nothing.
• Can be enabled in a running game: it starts with the next load.

Not Ironman / achievement compatible
Like every script mod, it changes the checksum: achievements and Ironman are off while it is enabled.

Unofficial fan project, not affiliated with Paradox Interactive.
```
