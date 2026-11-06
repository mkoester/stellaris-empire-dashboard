# stellaris-empire-dashboard

A second-screen dashboard for a running game of [Stellaris](https://www.paradoxinteractive.com/games/stellaris).
It reads the game's autosaves and shows your empire at a glance: history graphs (pops,
stockpiles, income), colonies and their pros and cons, expansion candidates, research and
traditions with due dates, the galaxy map you have discovered, and more. Loading an older save
starts a new branch instead of overwriting your history.

## Why I built it

- **A space empire without a BI tool?** The game starts in the year 2200, yet whoever runs a
  space empire or a megacorporation there has less information at hand than a company today gets
  from its business intelligence tools. That always felt wrong to me.
- **Overview.** The game spreads its state over many panels; I wanted it in one place, next to
  the game.
- **I am a bit of a min-maxer**, and the game's own tools kept limiting me.
- **Some things a player should simply know.** Which ships and stations I have seen in a system,
  for example — remembering what you saw is not cheating.
- **Learning how the game works.** Some systems are abstract or act only indirectly — the focus
  system, or the chain amenities → happiness → stability → job output. They deserve to be explained
  and shown, not guessed at.
- **A timelapse.** I always liked looking back over the whole game at the end of a Civilization
  match.

## A word of caution

Some of what the dashboard shows makes the game easier, and for some players that may take away
the fun. Everything the game hides until you find it (spoilers) or never tells a player at all
(cheats) is off by default and labelled as such in ⚙ — turn it on only if you want it.

**Multiplayer and Ironman:** nothing in the game can tell that a player is running the dashboard,
so it could spoil a multiplayer game for everyone else, and an Ironman game is meant to be played
as it comes. The dashboard therefore recognises both by their saves (with or without the companion
mod) and switches every cheat off there, along with the spoilers that reveal other empires or
space you have not explored (the whole galaxy, every wormhole and L-Gate, station owners, pact
intel); spoilers about the game's own content stay available. This guards against using it by
accident — it cannot stop someone set on cheating, so please don't use it against other people.

## For players

1. Download the zip for your system from the
   [latest release](https://github.com/mkoester/stellaris-empire-dashboard/releases/latest):
   `…-windows-x64.zip`, `…-macos-arm64.zip` or `…-linux-x64.zip`.
2. Unzip it anywhere and start `start.bat` (Windows), `start.command` (macOS) or `./start.sh`
   (Linux; needs `python3` 3.10 or newer, which most distributions and SteamOS have).
3. Your browser opens the dashboard. The first time, pick the game's install folder and the folder
   with your saves; it offers what it finds (Steam, GOG, Microsoft Store, macOS, Linux native,
   Proton). Every folder it looks in, per system and store:
   [Where things are](release/README.txt) (also in the zip).
4. Play. Every autosave shows up within seconds — monthly autosaves give the smoothest history.

Optional: the companion mod **Empire Dashboard Feed**
([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3826360023), [Paradox Mods](https://mods.paradoxplaza.com/mods/164724/Any)) adds daily stockpiles, exact reload branches, events
as they happen and values the saves do not hold. The dashboard picks it up by itself; like every
script mod it disables achievements and Ironman while enabled.

It only reads the game's files and your saves, stores its history in your user profile
(`%APPDATA%\stellaris-empire-dashboard`, `~/Library/Application Support/stellaris-empire-dashboard`,
`~/.local/share/stellaris-empire-dashboard`) and sends nothing anywhere. It is not code-signed:
Windows may warn that the app is unrecognised ("More info" → "Run anyway"), macOS refuses it the
first time (System Settings → Privacy & Security → "Open Anyway"). More in the zip's `README.txt`.

Found a bug, or a number that does not match the game? Post it in the
[`empire-dashboard` forum on Discord](https://discord.gg/djHbcvHNeu) — a screenshot of the game's
own screen next to the dashboard's helps most.

### Known limitations

- **It sees the game only as often as it saves.** Monthly autosaves give the smoothest history;
  anything that happens between two saves (a fleet passing through a system) is missed unless the
  companion mod logs it.
- **Reloading an older save without the companion mod**: where the new branch starts is a guess
  (marked, and correctable on the timeline page).
- **Multiplayer and Ironman detection are new** (above): checked against two multiplayer saves so
  far, each with one human player, and one Ironman save.
- **Game versions 4.3–4.5.** Numbers are checked against the game's own screens, but not all of
  them yet, and mostly on Linux; the Windows and macOS zips have been run, with less mileage.
- **English game texts only.**

Planning an empire before you play? The
[Stellaris Empire Planner](https://stellaris-empire-planner.mirkokoester.de/) is the companion web
app.

## For developers

SvelteKit on Node 24; game data from
[stellaris-data-extraction](https://github.com/mkoester/stellaris-data-extraction). Setup, how
it works and packaging: [`AGENTS.md`](AGENTS.md#running-it). Releases: [`RELEASE.md`](RELEASE.md),
changes: [`CHANGELOG.md`](CHANGELOG.md).

## Licence

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you
run a modified version as a public service, you must offer its source code to its users.

> Unofficial fan project, not affiliated with Paradox Interactive. Stellaris and all game data and
> text © Paradox Interactive AB.
