# stellaris-empire-dashboard

A second-screen dashboard for a running game of [Stellaris](https://www.paradoxinteractive.com/games/stellaris).
It reads the game's autosaves and shows your empire at a glance: history graphs (pops,
stockpiles, income), colonies and their pros and cons, expansion candidates, research and
traditions with due dates, the galaxy map you have discovered, and more. Loading an older save
starts a new branch instead of overwriting your history.

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
