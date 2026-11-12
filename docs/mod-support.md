# Mod support

Which of the user's subscribed mods (`../stellaris-mod-catalog/catalog.json`) the dashboard
copes with, and what is left. Assessed 2026-11-08 on 4.5.3. The mechanism is `AGENTS.md`, "Mods in
the game data": each campaign's data DB is extracted with its latest save's mods (since
2026-11-09; before, the launcher's last start for every campaign).

## Fine without the data (defines only, nothing in the dashboard caps them)

The dashboard limits none of these counts; the save holds what was taken.

- Civic points: 4 Civic Slots, More Civics, Simply Five Civics (`GOVERNMENT_CIVIC_POINTS_BASE`),
  4 Ethic Points + 3 Civic Points.
- Tradition trees: UIOD More Tradition Categories 12 / 16 / 24 (`TRADITION_CATEGORIES_MAX`, now
  in the data DB's `game_define` from the mod's own defines file).
- Ascension perks: UIOD Ascension Slots (`ASCENSION_PERKS_SLOTS = 100`, likewise).

Not yet looked at in a game with them.

## Supported through the data

Checked by extraction (2026-11-08, seven mods): rows added or changed as the mod says. **First
run in the app** (2026-11-09, `scripts/dashboard.sh`, Dev Tools + Ancient Highway): "extracting …
with 2 mods", a new cache file, `meta.mods` lists both in load order, the mod's resolution
category and its four resolutions are in the data DB, `/mods` shows both without a warning for a
save played with them. The mismatch warning itself is untested in the app.

- Designations: Hybrid Colony Designations (+45 `colony_type`, exactly its 45), Nanite World
  Automation (7 overrides).
- Districts and slots: Unlock More Building Slots (18 overrides), A More Building Slots…,
  Enhanced Urban Support Slots, BPV More Building Slots and its submods (inline scripts and
  scripted variables, resolved by the extractor). Building slots are not computed anyway (not in
  the save).
- Traits: More Picks (BIOLOGICAL picks 5 → 12), More Trait points and picks, More Traits Ethics and
  Civics; Trait Point Traits, Trait Diversity 4.0, Xenology (new traits with their costs).
- Tradition trees: More Traditions (32 → 84 trees with UIOD 12 and Better Traditions).
- Rebalances: Better Traditions (258 overrides, e.g. `tr_archivism_adopt` anomaly chance 0.05 →
  0.15), Better Perks, Better Origins, Better Leader Traits, Better Fanatic Ethics, Better Starbase
  Buildings.

- Starbase and arkship slots (since 0.1.14): **4.5.3 counts them from the ship size**
  (`starbase_module_capacity_add`, `starbase_building_capacity_add` in `common/ship_sizes/`);
  `starbase_levels`' slot lists only name the slots ("must have at least the correct size", its
  documentation). The dashboard counts that way (`levelSlots()`, AGENTS.md "Starbases tab"), so
  Slightly Larger Starbases [4.5] shows a starport's 3 modules and 2 buildings — Commonwealth of
  Man's capital held 3 modules at 2200.02.01. **Outpost Slots loses to it**: both define
  `starbase_outpost`, and the later file name wins (`zz_bigger_starbases.txt` over
  `01_alice_starbases.txt`), whose outpost has no slots. Open: an outpost in game, to confirm.

Open: the pages in a game with these mods — traditions tab shows the modded tree, designation names
and what-ifs, the species tab's trait budget against the game's species screen (screenshots).

## Needs a check first

- **Planetary Diversity, Guilli's Planet Modifiers** — names and modifiers arrive; habitability and
  capacity of 166 new planet classes need the game's screen to compare.
- **Shed the Old Ways** (`../stellaris-mod-ShedOldWays`, private) — removes a tradition tree after
  ascension (`remove_tradition_tree`). The traditions tab reads `country.traditions` each save, so a
  removed tree drops out by itself. To build once its Phase 0 spike has shown what the save holds
  after a removal (tree and picks gone? perk slots?): a "tree shed" milestone (an adoption gone
  between two saves, `#lib/milestones.ts`) and the mod's swap count and price from its `ssow_`
  variables.

## The playset played (2026-11-09)

Commonwealth of Man (4.5.3), 50 mods — roughly how the user plays, Ancient Highway and Shed the Old
Ways to come: Better Origins, Perks, Traditions and Leader Traits; BPVR More Building Slots (City 9
Slot, 4 Zone Slots, 3 City Zones, Zone Double Row Mode on UI Overhaul Dynamic); Hybrid Colony
Designations; Slightly Larger Starbases [4.5], Outpost Slots; Empty Hulls and both First Contact
mods; two zips (Federations Less Stingy, Research options+); the rest UI. Extracted with all 50 in
7 s on a warm parse cache, no error; the save reads with names from it. **Building slots and zones
need nothing from the data** (the `zone` table holds names; the save holds zones and buildings) —
BPVR's third city zone shows once one is built. Starbase slots: above.

## Limits of the merged view

- **The load order is the launcher's, not the save's**: the save names mods only. The dashboard
  remembers the order of saves it sees written live; for a campaign it never saw played, and no
  playset holding exactly its mods, the closest playset's order is taken — wrong only where two of
  its mods override the same definition and their order changed since.

- The rules (`extractor/mods.py`): a file replaces the same path; in a `common/` folder the later
  file's definition of a key wins, in `scripted_variables` the first (the mods' `zzz_` and `!!`
  prefixes rely on it); `on_actions`, `defines`, `inline_scripts` merge. `replace_path` drops the
  earlier files of that folder only, not its subfolders — unconfirmed.
- Windows: symlinks need developer mode, so files are hard-linked or copied and folders joined —
  not run on Windows yet.
