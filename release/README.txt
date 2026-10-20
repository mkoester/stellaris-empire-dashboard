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
Linux:    run ./start.sh  (or: sh start.sh). Needs python3 (3.10 or newer), which most
          distributions and SteamOS already have.

Your browser opens the dashboard. The first time, it asks for two folders and offers what it
found on this computer:

  - the game install (Steam: ...\steamapps\common\Stellaris), and
  - the folder with your saves (Windows: Documents\Paradox Interactive\Stellaris; Linux
    with Proton: ...\steamapps\compatdata\281990\pfx\drive_c\users\steamuser\Documents\
    Paradox Interactive\Stellaris).

Then play: every autosave shows up within seconds. Monthly autosaves give the smoothest history
(game settings: autosave every month).

Keep the window open while you play; closing it stops the dashboard. To change the folders later:
the gear tab (top right), "Folders".

Options: start.bat --lan / ./start.sh --lan also serves other devices on your network, e.g. a
tablet as the second screen (open http://<this computer's address>:<port>/ there; the window
shows the port, usually 5174).


What it does with your files
----------------------------

It only reads the game's files and your saves; it never changes them. Everything it keeps (your
history, its settings, the game data it reads once per game version) is stored in

  Windows: %APPDATA%\stellaris-empire-dashboard
  Linux:   ~/.local/share/stellaris-empire-dashboard

Nothing leaves your computer: no accounts, no telemetry, no internet needed. Without --lan it is
reachable from this computer only.


Updating
--------

Download the new version, unzip it next to the old one, start it. Your history and settings stay
(they are in the folder above); then delete the old folder.


More
----

Source, issues and new versions: https://github.com/mkoester/stellaris-empire-dashboard
Plan an empire before you play: https://stellaris-empire-planner.mirkokoester.de/
Licence: AGPL-3.0 (LICENSE). Bundled software and its licences: THIRD-PARTY-NOTICES.txt
