Stellaris Empire Dashboard
==========================

A second screen for your running Stellaris game: your empire at a glance and its history over
time, read from the game's autosaves. Loading an older save starts a new branch instead of
overwriting your history.

Unofficial fan project, not affiliated with Paradox Interactive. Stellaris and all game data and
text (c) Paradox Interactive AB.


Start
-----

Windows:  double-click start.bat
          Windows may warn about an unrecognised app ("Windows protected your PC"): click
          "More info", then "Run anyway". The dashboard is not code-signed.
macOS:    double-click start.command (macOS 13.5 or newer; the -arm64 zip for Apple silicon, the
          -x64 zip for Intel Macs). The first time macOS refuses it as from an unidentified
          developer (the dashboard is not signed): open System Settings, Privacy & Security,
          and click "Open Anyway" next to start.command; then start it again.
Linux:    run ./start.sh  (or: sh start.sh). Needs python3 (3.10 or newer), which most
          distributions and SteamOS already have.

Your browser opens the dashboard. The first time, it asks for two folders, the game install and
the game's user folder (the one holding "save games"), and offers what it found on this computer.
If it found the wrong one or none, see "Where things are" below.

Then play: every autosave shows up within seconds. Monthly autosaves give the smoothest history
(game settings: autosave every month).

Keep the window open while you play; closing it stops the dashboard. To change the folders later:
the gear tab (top right), "Folders".

Options: start.bat --lan / ./start.sh --lan also serves other devices on your network, e.g. a
tablet as the second screen (open http://<this computer's address>:<port>/ there; the window
shows the port, usually 5174).


Companion mod (optional)
------------------------

"Empire Dashboard Feed", on the Steam Workshop and Paradox Mods, makes the game write a few
numbers the saves do not hold: the stockpile every day (not just at autosaves), which save you
just loaded (so a reload's branch is exact, not a guess), events as they happen, and values
the dashboard otherwise estimates (marked ≈): your storage, other empires' storage, Galactic
Community voting weight. Subscribe and enable it in the launcher; the dashboard picks it up by
itself. Everything works without it.

  Steam Workshop   https://steamcommunity.com/sharedfiles/filedetails/?id=3826360023
  Paradox Mods     https://mods.paradoxplaza.com/mods/164724/Any

Like every script mod it disables achievements and Ironman while it is enabled.


What it does with your files
----------------------------

It only reads the game's files and your saves; it never changes them. Everything it keeps is in
its own folder (see "Where things are"). Nothing leaves your computer: no accounts, no
telemetry, no internet needed. Without --lan it is reachable from this computer only.


Updating
--------

Download the new version, unzip it next to the old one, start it. Your history and settings stay
(they are in the dashboard's own folder, see "Where things are"); then delete the old folder. If
a new version changes how the history is stored, it keeps a copy of the old one beside it
(dashboard.v15.sqlite, ...); an older version refuses a history the newer one has changed, so
start the new one.

The history of a game you no longer want: the gear tab, "Games", delete. When all saves of a game
are gone, the dashboard asks once whether to keep its history.


Where things are
----------------

The dashboard's own folder:

  Windows   %APPDATA%\stellaris-empire-dashboard
  macOS     ~/Library/Application Support/stellaris-empire-dashboard
  Linux     ~/.local/share/stellaris-empire-dashboard  (or $XDG_DATA_HOME/...)

  dashboard.sqlite (+ -wal, -shm)   your history and settings: back these up together
  dashboard.v15.sqlite, ...         a copy kept before a new version changed the history
  config.json                       the two folders you picked
  data/stellaris-<version>-....sqlite   game data, read once per game version and DLC set

The game install (pick this as "game install"):

  Steam, Windows        C:\Program Files (x86)\Steam\steamapps\common\Stellaris
                        (or <your Steam library>\steamapps\common\Stellaris)
  Steam, macOS          ~/Library/Application Support/Steam/steamapps/common/Stellaris
  Steam, Linux          ~/.local/share/Steam/steamapps/common/Stellaris
                        Flatpak: ~/.var/app/com.valvesoftware.Steam/.local/share/Steam/...
                        Snap:    ~/snap/steam/common/.local/share/Steam/...
  GOG, Windows          C:\GOG Games\Stellaris, or
                        C:\Program Files (x86)\GOG Galaxy\Games\Stellaris
  GOG, Linux            ~/GOG Games/Stellaris/game, Heroic: ~/Games/Heroic/Stellaris,
                        Lutris: ~/Games/stellaris
  Microsoft Store       <drive>:\XboxGames\Stellaris\Content

  The right folder holds launcher-settings.json and a "common" folder.

The game's user folder (pick this as "user folder"; your saves are in its "save games"):

  Windows               Documents\Paradox Interactive\Stellaris
                        (with OneDrive: OneDrive\Documents\Paradox Interactive\Stellaris;
                        Microsoft Store builds may name the last folder differently)
  macOS                 ~/Documents/Paradox Interactive/Stellaris
  Linux, native         ~/.local/share/Paradox Interactive/Stellaris
  Linux, Proton         <Steam library>/steamapps/compatdata/281990/pfx/drive_c/users/
                        steamuser/Documents/Paradox Interactive/Stellaris
  Linux, Wine / Heroic  <prefix>/drive_c/users/<user>/Documents/Paradox Interactive/Stellaris

  Inside: "save games/<one folder per game>/*.sav", "logs/game.log" (read only with the
  companion mod), "mod/". Playing on Linux through Proton, the saves are in the Proton folder,
  not the native one, even when both exist.


More
----

Source, issues and new versions: https://github.com/mkoester/stellaris-empire-dashboard
Plan an empire before you play: https://stellaris-empire-planner.mirkokoester.de/
Licence: AGPL-3.0 (LICENSE). Bundled software and its licences: THIRD-PARTY-NOTICES.txt
