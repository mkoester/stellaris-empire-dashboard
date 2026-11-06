# Open checks (from the 2026-10-22 session)

What the systems, produce, jobs, growth, tech and trade tabs still need from the game. Each item:
what is open, how to check it, and what to send. Screenshots go to the game's own folder
(`<Stellaris user dir>/screenshots/`, F12 in game); name the colony or system in the message.
Background for each is in `AGENTS.md` (sections named below).

## A. Screenshots from the real campaign (no cheats needed)

Session 2026-10-22 (Planetforgers, 2212.03.05, screenshots `2026_10_22_1`–`21`) settled outpost
and starbase costs, the market price formula, tech costs and research rates; results in
`AGENTS.md` → Open. What is left:

### 4. Market buy price — produce tab (small remainder)

The formula is confirmed (base × (1 + fluctuation) × (1 + fee)): alloys 5.20, energy 1.24, food
1.30 match. Minerals (game 1.32, ours 1.31) and consumer goods (2.55, ours 2.56) lean the way the
monthly automatic trades push them (buy 42 minerals, sell 10 consumer goods) — the save's
fluctuation may lag the screen.

- **Do:** at the next autosave on the 1st, open the market with minerals and consumer goods.
- **Send:** the screenshot and the date.

### 4b. Cooldowns, rolls and travel in Upcoming (2026-10-25) — throwaway game

Per item: a manual save before and after (diff in `$TMPDIR`), a screenshot of the greyed-out
tooltip ("available in …"), the dashboard's row for comparison. **Done 2026-10-25** (throwaway
`unitednationsofearth_-15512622`, results in `AGENTS.md` → "Cooldowns and expiries" and "Run-out
cooldowns stay"): minor artifact actions, the relic triumph, Satisfying Insults, colony decisions
on two colonies, species rights, moving the capital, the reform date, insults per empire, and a
run-out cooldown dismissed on a reloaded branch. Still open:

1. **Astral actions**: `resource astral_threads 5000`, use one — which field records the use and
   its engine `cooldown` (data DB `astral_action_cooldown`); `usages` in the country block.
2. **Dimensional Lock** on a wormhole: the lock's save fields while built (180 days) and while it
   holds (3600), and their end against the game's tooltip.
3. **Shroud / psionic**: a delve (`last_delve_date`, `shroud_cooldown*`), a Shroud power or covenant
   used, a calling refreshed (`CALLINGS_REFRESH_COOLDOWN_DAYS` 360).
4. **Engine cooldowns left**: a federation law change (its timers sit on the federation, not read
   yet), the jump drive (`jump_drive_cooldown`).
5. **Rolls**: an envoy on a first contact and a science ship on a dig site — the next roll's date
   against `days_left`, and the cycle after a roll (`last_roll`).
6. **Days per jump**: a military fleet and a science ship over a known number of jumps, with a
   manual save each few days — calibrates `DEFAULT_DAYS_PER_JUMP` (10, a placeholder).

### 5. Trader enclave deal — trade tab

The trade tab prices XuraCorp's exotic gases (and the Riggans' motes, Muutagan's crystals) from
the 4.5.2 event script: 500·N energy at once, +N a month and −10·N energy a month for 10 years,
N = 1…5 — 14.2 energy a unit whatever N. Not yet seen in game; a deal's modifier in the save
(`enclave_trade_N_xur`) is what the tab reads as "our deal".

- **Do:** open XuraCorp (in contact in the campaign) → strategic resource; hover the options.
- **Send:** a screenshot of the options and their tooltips. If you take a deal, the date — the
  next autosave should show it on the trade tab.

### 11. Predicted votes — galcom tab, Proposable (from 2026-10-23)

Each AI's vote is predicted from the resolution's `ai_weight` × its opinion of us (0.5 at −750,
1.3 at 750, **linear between — assumed**). Checked only on Buzzword Standardization (base 7: the
three members with negative opinion missing from the game's list, exactly). The other proposable
ones carry `?` (conditions the save cannot answer for other empires).

- **Do:** on the Resolutions screen, hover "… Support" of each resolution the tab lists as
  proposable now (Charter of Worker's Rights, Equal Standing Act, Exploitation Act, the two Storm
  ones, Form Galactic Council).
- **Send:** each "Empires likely to support this Resolution" tooltip — compared with the tab's
  "for" list, it tests the opinion curve away from neutral and the unknown conditions.

### 12. Diplomatic weight with envoys or a council seat — galcom tab

Our weight's breakdown matched the game's tooltip at 2214.02.01 (no envoy in the Community, no
council). Envoys (`diplo_weight_delegate_mult`, +10 % each, Gravitas +2.5 %) and a council seat
(`diplo_weight_council_mult` +20 %, and × 1.5 when voting — `COUNCIL_DIPLOMACY_WEIGHT_MODIFIER`)
are listed, not summed.

- **Do:** once an envoy is assigned to the Galactic Community (or the council forms with us on
  it), hover our weight next to "Proposal Queue".
- **Send:** the tooltip; then the tab's "not explained" line shows how far off it is.

### 13. What intel shows of others — diplomacy tab

The tab follows the game's intel levels from the files (pacts and opinions from intel 50) and
treats subjects and wars between others as public — an assumption.

- **Do:** open the diplomacy view of one empire we have intel < 50 on and one ≥ 50.
- **Send:** both screenshots — which pacts, rivals, subjects and wars the game shows of them.

### 15. Naval capacity, and the `all` tab's error page (from 2026-10-25)

Companion mod 0.6.0 exports the naval capacity (`sdash_nc`); never run in game. Separately, the
Mac run of 0.1.1 showed a 500 on the `all` tab after a month, gone on reload — not reproduced
(every replayed state renders server-side), so a browser-side error; charts now rebuild when their
lines change, the suspected cause.

- **Do:** with mod 0.6.0, let an autosave pass with the `all` tab open; keep the browser's
  developer console open (it names a browser-side error).
- **Send:** a screenshot of the fleet manager's naval capacity and the date; any console error
  and the start window's output if the 500 shows again.

### 16. Ethics attraction — the factors the save cannot tell (from 2026-10-30)

Settled 2026-10-30 (throwaway nomad game, 2200.05.01, screenshots
`~/Pictures/Screenshots/screenshot_2026-10-30_20-09-12` … `20-09-53`; `AGENTS.md` → Ethics tab).
**Settled 2026-10-31 on the 4.5.3 open beta** (Roaming Korinth 2204.08.01, save; dashboard's
ethics tab): the rules now add onto 1, and what the save cannot tell is the council —
`value:count_councilors_with_ethic` = 0.1 (`@council_ethic_attraction`) per ruler or councilor with
the ethic. Egalitarian ×2.45 = 2.25 known + 0.2 (two councilors), xenophile ×2.1 = 2 + 0.1 (one),
spiritualist ×2.1 = 2 + 0.1 (the ruler): every remainder exact, so "From Relations" was 0. The
4.5.2 numbers (×3 = ×2.5 × 1.2, ×2.2 = ×2 × 1.1) fit the same count as a factor. The game's
tooltip (`screenshot_2026-10-31_01-49-58` … `01-50-08`) shows pop attraction, not these factors.
Done 2026-10-31: the dashboard counts the council rule from the save's leaders (extractor
`ethic_attraction.per_json`); the three ethics read ×2.45 / ×2.1 / ×2.1, known in full.

### 17. Amenities, happiness and stability — colony page (from 2026-10-30)

Settled 2026-10-30 (Roaming Korinth 2203.02.01, screenshots
`~/Pictures/Screenshots/screenshot_2026-10-30_22-12-11` … `22-13-38`): approval → stability and
stability → job output are linear (+28.5 at 97.5 %, +28.88 % at 98.143); the amenities' +20 % cap.
**Settled 2026-10-31 (4.5.3 open beta, 2204.08.20, `screenshot_2026-10-31_01-49-08`):** amenities
between the ends are linear too — 9659 provided for 6020 needed (1.604×) gives "Citizen Pop
Happiness +12.0 %"; linear predicts +12.09 % (a curve would be far off: squared, +7.3 %). The
save (2204.08.01) holds 9655.6 / 6020 / 3635.6 free against the tooltip's 9659 / 6020 / 3639 nineteen
days later.

### 18. Wanderlust — an arkship's visit (from 2026-10-31)

The dashboard reads the systems an arkship counted from the star flag `visited_by_nomad@<our
country id>` (`nomads.4720` sets `visited_by_nomad@root.owner`) — **its spelling in a save is
assumed**: no save has one yet. Without it the events still come, from the counters, dated to the
month's save instead of the day.

- **Do:** fly the arkship into a system the map marks ⚑ (Wanderlust, "not yet by an arkship"),
  then save.
- **Send:** the save's name. Check: `grep -o 'visited_by_nomad[^=]*=[0-9]*' gamestate`; the map
  should then say "counted <date>" there and the events tab "Wanderlust: <system> (…)".

### 19. Tech costs on another difficulty or tech-cost scaling (from 2026-10-31)

Measured: cadet and admiral with "Difficulty Adjusted Technology Costs" on Normal (tier 1 ×1.05
and ×1.25). Assumed: Low and High as steps 1 and 3 of Normal's 2, and the ranks of the
difficulties in between (#lib/events.ts techCostFactor).

- **Do:** in a game on another difficulty, or with that setting on Low, High or Off, open the
  technology screen.
- **Send:** a screenshot (a tech's cost) and the save, with the galaxy settings.

### 20. Leader limits per class — leaders tab (from 2026-10-31)

The tab shows hired / limit per class (Roaming Korinth 2204.12: 2 / 4 each), the limit computed:
base 3 + every `country_<class>_cap_add` and `country_leader_cap_add` of what the save shows held —
traditions, perks, edicts, policies, civics, the origin, technologies, timed modifiers. Species
traits, leaders' own traits and situations are not counted.

- **Do:** open the game's leader screen (where it shows each class's count and limit).
- **Send:** a screenshot and the date.

### 21. The outliner's Roman numerals — colony vs. fleet (from 2026-10-31)

**Unverified.** On 2204.12 (4.5.3) the outliner showed "III" on the arkship colony (and beside its
designation, Capital Arkship) and "II" on Military Arkship I. Read as: the colony's numeral is its
governor's skill (Clyda Alford, level 2 + 1 bonus = 3; the colony's `governorSkill` 3, ascension
tier 1, capital building level 2), the fleet's its commander's base level (Fagan Nightsedge, also
2 + 1, shown as II). The leaders tab acts on level + bonus for every role ("fleet (3)"), as the
game's leader tooltip ("Skill Level: (2+1)/10") does. One sample only, both leaders at 2 + 1.

- **Do:** later in the game, when a governor and a commander differ in level or bonus (or the
  colony gets another ascension tier or capital upgrade), hover both numerals.
- **Send:** the screenshots and the date; the save.

### 22. Stability above the cap — colony page, companion mod 0.8.0 (from 2026-10-31)

**Partly checked 2205.10.01** (screenshots `screenshot_2026-10-31_09-25-00`, `-09`): the mod's
`sdash_stab_add` (33.35) is the tooltip's lines but approval (10 + 5.6 + 17.7), and base + flat +
approval's share is the tooltip's sum (110.9; the game shows approval rounded, +27). Stored on
the colony's carrier — the arkship's ship block. Still open:

- **A planet colony**: whether its variables land on the planet (`planets.planet.<id>.variables`,
  which `save.ts` reads). **Do:** once there is one, find `sdash_stab_add` in a save.
- **A stability multiplier** (`planet_stability_mult`, 0 so far): assumed to scale the whole sum.
  **Do:** when one applies (an edict, a situation stage), hover the stability of a colony at the
  cap. **Send:** the screenshot and the date.

### 23. Colony jobs by day — colony page, companion mod 0.9.0 (from 2026-10-31)

**Broken in game — fix the mod first** (seen 2026-10-31 in the 10:59 session's logs, 4.5.3):
`error.log` says `cannot find: num_sapient_pops` (`events/sdash_events.txt` line 181 — no such
trigger in 4.5.3's `triggers.log`; `num_unemployed` and `free_jobs` are there), and every line came
out empty, `SDASH|2|2205.10.02|event|colony-jobs|Peshnab the Faithful|||` once a month, with
"Unknown property `sdash_fj`" for the colony's variables in the log text. The dashboard rejects
those lines (malformed, per line), so nothing is stored. Don't upload 0.9.0+ to the stores before
this check passes.

**2026-11-01, 0.10.1 before its last fix** (Roaming Korinth, 4.5.3, 2206.11.18 → 2207.01.10, save
`2207.01.10.sav`): no `cannot find` any more, but the lines still came out `|||` with "Unknown
property `sdash_fj`" — **the export works, the log line read the wrong scope**: the variables sit
on the colony's carrier (`ships.0.variables`: `sdash_fj=286`, `sdash_un=0`, `sdash_pp=5814`), and
loc in colony scope cannot reach them (its promotions are Owner, System, Sector, Planet, Ship). The
values match the save: `pop_amount` 5814 = `num_sapient_pops`, no civilians, and `free_jobs` 286 =
the farmers' open workforce — the enforcers' 100 open are **not** in it (so it agrees with
`openJobs()` under crime automation, and the unit is workforce). Fixed by logging inside
`carrier = { }` — **seen 2026-11-01**: `SDASH|2|2207.02.02|event|colony-jobs|Peshnab the
Faithful|279|0|5821` (7 more pops, 7 fewer open workforce than the save's 286 / 5814 at 02.01),
no `sdash` error. Lines fire only on a change (3 of 52 days before; none 2207.01.10–02.01, the
values unchanged). Still open below: the numbers against the game's own tooltips.

**Earlier fix:** `num_sapient_pops` is a save field, not a trigger; the mod
now exports `pop_amount` (vanilla's `trigger:pop_amount`). Why `sdash_fj` and `sdash_un` came out
empty too is not known — the next session's `colony-jobs` lines and `error.log` tell whether that
fix was enough. `pop_amount` may count non-sapient pops the save's `num_sapient_pops` leaves out.

**Unverified.** The mod logs a colony's `free_jobs`, `num_unemployed` and `num_sapient_pops` on
each day one changes; the dashboard reads unemployed as civilians and pops − unemployed as
employed. Assumed: those triggers count what the save's `civilian`, `employable_pops` and open
positions (`max_workforce − workforce`) count — `free_jobs` may include the enforcer posts the
dashboard leaves out under crime automation (`openJobs()`), which would show as a jump at each save.

- **Do:** with the mod at 0.9.0, queue a building with jobs on the arkship; on the day it finishes
  and the few days after, hover the colony's jobs and pops in the game; a manual save on one of
  those days.
- **Send:** the screenshots with their dates, the save. Check: the `colony-jobs` lines in
  `logs/game.log` against the game's numbers, and the Pops chart's tick days against the saves'.

### 24. System entry events — map and events tab, companion mod 0.10.0 (from 2026-10-31)

**Partly checked**: Bir and Helito as the user saw them (2026-10-31); the four abandoned gateways
reduced to two by their once-flags (Urakhannon's Maw's L-Gate, Acamar) — not asked whether those
two showed the popup. Unverified: the mod's `system-entered` line (`[From.GetName]` in a
ship_event's scope), and the matches' other conditions (a match is "likely").

- **Do:** with the mod at 0.10.0, enter a new system (any) and one with a popup.
- **Send:** the date and the popup's title; `logs/game.log`'s `system-entered` lines. Check: the
  events tab dates the popup's system to that day, and a system without a popup shows nothing.

### 26. Arkships on the maps, settling down — map, migration and expansion tabs (from 2026-11-01)

Read from the Roaming Korinth saves (2207.02.01: the capital arkship Peshnab the Faithful at
Selea, system 563), not yet seen beside the game. **Assumed**: Arkship Remains' +60 %
environment tolerance counts on every colonizable class, also where the species' own
habitability is 0 % (an Ark-preference species: `trait_pc_ark_preference` gives only
`pc_ark_habitability`) — so the expansion tab's "Hab. settled" reads 60 % on every planet for
such a species. Whether the game's expansion planner shows a settle target's habitability at all is
unknown too.

- **Do:** on Roaming Korinth, open the galaxy map at the capital arkship; then the expansion
  planner with the arkship selected (settling needs Adaptability finished first — until then the
  planner may hide the targets).
- **Send:** both screenshots and the date. Check: the dashboard's arkship marker and "capital"
  button land on the same system; the planner's habitability for a target matches "Hab. now", and
  once settled the planet's habitability matches "Hab. settled".

### 27. Map modes and full window — map tab (from 2026-11-02)

Recomputed from `__data.json` on a DB copy (Planetforgers 2214.02.01, Roaming Korinth
2207.02.01) but never compared with the game's map or drawn in a browser. **Assumed**: the
diplomatic order and colours as `common/map_modes/00_map_modes.txt` lists them; our relation
record's `threat` is the threat we feel from them, not theirs from us (every empire read 0 in both
campaigns, so nothing showed it); the save's `hostile=yes` is not the game's `is_hostile` (it sat
on our subject Lolehndra, so the war colour comes from wars alone).

- **Do:** in a campaign with several contacts, the game's diplomatic (Ctrl+X), opinion (Ctrl+C)
  and AI attitude (Ctrl+V) map modes, zoomed out over the known empires; then the same modes on
  the dashboard's map tab, also in "⛶ full window", once with "wide + table".
- **Send:** the three screenshots and the date. Check: each empire's colour and its reason match
  the game's; an empire that threatens us (after a war or a conquest nearby) shows `threat` above
  0, and whose record it is in; full window fills the browser, the table beside scrolls on its own
  and Esc goes back.

### 28. Deficit fee and what-ifs — colonies, colony and government tabs (from 2026-11-02)

The fee rule (MattMills/stellarstellaris-win, inferred there) fits our saves within 4.4 % (the
budget's `planet_resource_deficit` against the sum), but no colony's own share has been seen in
game, and the what-ifs (⚙ What-ifs, a spoiler) are estimates never compared with a change made.
**Assumed**: the capital is the colony whose shortfall `country_base` covers; an output modifier
adds its share of today's output (an upper bound); a designation's candidates are those of its own
kind.

- **Do:** with the switch on, note one edict's "≈ if enacted now" and one colony's designation
  what-if; enact the edict (or switch the designation), let a month pass, then the budget's
  Planetary Deficit line (hover) and the resource's income tooltip.
- **Send:** the screenshots before and after, and the date. Check: the colonies tab's deficit
  total against the budget line; the month's change against the estimate.

### 29. Influence and pacts — influence and pacts tabs (from 2026-11-05)

Power projection is a fit, not a rule from the files: 2 × min(1, 2 × used naval capacity ÷ empire
size), exact in 40 saves; with no navy it books 0.2 (two empires, 2026-11-05 — settled), read as
a 10 % coverage floor. Income
lost at the storage cap is inferred without the companion mod (a stockpile that did not move
although the budget booked a gain).

- **Do:** hover the influence income in the top bar, and the navy size / naval coverage line of
  the fleet manager; note the influence stockpile.
- **Send:** the screenshots and the date. Check: the influence tab's sources and "Not collected"
  against the tooltip's Power Projection line and its maximum (`country_power_projection_max`).

### 31. What the engine adds to job output — jobs tab (from 2026-11-05)

**High Stability settled 2026-11-05**: +30 % × (stability − 50) ÷ 50 (the throwaway game's Physicist
tooltip: stability 73.345 → +14.01 %), now counted. Low Stability (−50 % × (50 − stability) ÷ 50) and
the governor's sector effect (not for its own colony) settled 2026-11-06 from the 2219.01 Miner and
Technician tooltips. Left in the panel's "Rest": +10 % on Planetforgers' capital research (Pleased,
+25 % workers and specialists — when?), −1 % (Theian Preservers 2201) and −3 % (Korinth) on worker
jobs, alloys and minerals on Planetforgers, and job output lost in a resource shortage (inputs).

- **Do:** hover a worker job's output (Miner, Technician) on a capital, and on Planetforgers' capital
  a Physicist's.
- **Send:** the tooltips and the date. Check: the lines the panel does not count yet.

## B. Throwaway-game sessions (console cheats; separate `DASHBOARD_DB`)

Setup as in `AGENTS.md` → "Testing in a throwaway game".

### 30. Research agreements and migration treaties — pacts tab (from 2026-11-05)

**Settled 2026-11-05: the +25 % adds** to our other research speed bonuses (throwaway Theian
Preservers 2200.06–07: ×1.26 → ×1.51; the tooltip lists the agreement as +25.00 %). **Two partners
with the same tech count once** (2200.08–2201.01: ×1.51 with both; the tooltip lists only one
agreement line). Open: how fast pops cross under a migration treaty (the tab shows species
counts per empire; no save of ours has seen a pop cross yet — Planetforgers' 719 Pyrrag'Thul with
the Oklarr may predate the treaty).

**Throwaway Theian Preservers, 2200.10–2214.01 (pacifist, fanatic materialist; treaties with three
xenophile AIs):** no pop arrived in our empire in 11 years — with 1,000+ open jobs on two colonies,
one of them arid (80 % for the Baanthurians, the crater modifier removed), migration allowed on
both sides, policies `resettlement_allowed`. Meanwhile treaty migration ran between the AIs
(Belmacosa homeworld: 502 Baanthurians at 50 % habitability, 118 Humans; United Nations: 112
Baanthurians) and **our own species left us**: 338 Theians in three new Baanthurian colonies — our
grown pops (they start as civilians, Dev Diary 388) emigrating while our open worker jobs stayed
open. Every receiving empire is xenophile; xenophilia has no migration modifier in the files
(`common/ethics/00_ethics.txt`, only pop attraction). **Not the condition:** with our pacifism
swapped for xenophile by console (2214), still no immigrant by 2219.01, while emigration went on
(Theians: 478 with the Baanthurian Council, 102 with the United Nations, a treaty partner). Open,
and engine-side: what makes an empire a destination — the dashboard only reports it.
The pacts tab lost the emigrants: the Baanthurian treaty ended, and `speciesByEmpire` reads only
current partners.

- **Do:** two research agreements with empires that both have a tech we can research
  (a throwaway game), research it, hover its
  progress in the research screen; a migration treaty with a neighbour and two months.
- **Send:** the tooltip's speed bonus lines and the dates. Check: the pacts tab's "extra this
  month" against the tooltip; the species counts across the two months.
- **Stacking, in the throwaway game:** give a second empire the tech in progress (`play <id>`,
  `research_technology <tech>`, `play 0`), sign a research agreement with it, two months: ×1.76
  (1.51 + 0.25) means each partner counts, ×1.51 once.

### 6. Trade calibration — the rest (paused 2026-10-23)

The trade model is fitted to tooltips at 16 empires, gifts and deals (2026-10-23; summary in
`docs/trade-calibration.md` → What we know, how to resume → Paused). Done in the campaign without
cheats — tooltips set up, not sent — not in a throwaway game. Open:

- the gift's decay: solved (2026-10-24) — the whole stack loses 2 a year, on the first gift's
  anniversary; a further gift does not reset it (`docs/trade-calibration.md` → Gifts);
- when a monthly deal breaks: in game it ended with "the other empire can't afford the monthly
  rate of resource X" — at a zero stockpile, or a negative net income? The deal finder's monthly
  mode assumes the stockpile runs out (net income after paying, months it lasts);
- the drift of basic resources (minerals and food up 6–9 % every half year, energy 10 % then
  flat, the rest steady; ruled out so far: `docs/trade-calibration.md`): its shape — KhellZen's
  seven-resource tooltip (nothing sent) at every monthly autosave for a few months. Smooth points
  to time, steps to a state change on their side (then compare that month's save). 2213.08 → 2214.01:
  no step, ~1 % down at 10,000's resolution. Mind an AI's room (0.8 of storage): offer 10,000
  only where it fits;
- the galactic market: **still open** — the 2026-10-24 throwaway test (`docs/trade-calibration.md`)
  founded it with us as its only member (no Galactic Community, so no AI had access); it showed our
  access changes nothing an AI values, not what an AI on the market does. Redo with the Community
  founded and the AIs in it;
- strategic resources: at once measured (2200.03.01 throwaway game, `docs/trade-calibration.md`);
  left: one monthly deal to confirm the 0.5 × months rule holds for them too (nanites are not
  tradable);
- the basic resources' curves at game start differ from the campaign's (consumer goods, alloys,
  food, trade; same file): when do they change — a step at some event, or gradually?;
- where a fallen empire's room really ends in a deal: its storage is known now (companion mod
  0.5.0: base + 120,000), so offer it alloys up to and past 0.8 of that to see the cut-off.

### 7. Stored research — tech tab

`AGENTS.md` → Open → "Stored research". The 4-day puzzle is solved (a monthly chunk after the
1st's autosave), and the game's tooltip shows stored research adding the modified monthly gain
while drawing the base. Left: confirm the draw per month equals the _base_ gain over a few months,
and what a tech finishing mid-month does with its overflow — plain monthly autosaves of the
campaign suffice, no cheats.

- **Send:** nothing; read from the next autosaves (`tech_status.stored_techpoints` vs. progress).

### 27. Multiplayer detection — ⚙ cheats off, companion mod 0.11.0 (from 2026-11-03)

`AGENTS.md` → "No cheats in multiplayer". The rule: a save whose `player` block names an account
or lists two players is multiplayer. Seen so far: single player `unknown` (106 saves); Oracularity
of Noerm, a new multiplayer game, only `MirkoMachine`; UNE 2 `unknown` alone at 19:01, then
`unknown` + `MirkoMachine` in every save from 19:41 on — after the Noerm session, loaded in a way
nobody remembers. If a single-player load adds the account, the rule calls such a game
multiplayer and turns its cheats off wrongly.

- **Single player after multiplayer:** host any multiplayer game, quit to the menu, load a fresh
  single-player save (e.g. `dashboardtest1` 2200.01.01) in **single player**, save → its `player`
  block. `unknown` alone: the rule stands; `unknown` + the account: the rule needs another signal.
- **A single-player save hosted:** load a single-player save through the multiplayer lobby, save
  → its `player` block (UNE 2's shape expected), and with mod 0.11.0 the
  `SDASH|2|<date>|event|multiplayer` line in `game.log` at the next month.
  **2026-11-04, 4.5.3 (4e91), passed for the mod:** Yorphian Extractorate, a single-player game
  loaded through the lobby, the empire picked again ("Previously Played By: unknown",
  `screenshots/2026_11_04_1.png`): `game.log` has `SDASH|2|2203.11.01|event|multiplayer` (mod
  0.11.0), and the autosave 2203.11.01 lists `unknown` + `MirkoMachine` — UNE 2's shape, so the
  save rule agrees. A first lobby run (mod still 0.10.1) seemed to leave `unknown` alone, but that
  file's time went unchecked and the second run overwrote it: no evidence either way.
  **The dashboard passed too:** with that campaign viewed, ⚙ says "This is a multiplayer game:
  the cheats are off" and lists no cheat switch.
- **The dashboard:** with that campaign viewed, ⚙ says "This is a multiplayer game" and no cheat
  switch is listed; a tab with a cheat on before (e.g. `historyAll`) shows only what you know.
- **Send:** the save names, and whether the lobby or single player loaded each.

### 25. A root 404 during the first start — release smoke test (2026-10-31)

Smoke-testing the v0.1.6 Linux zip on an empty data folder, `/` answered 404 once, seconds after
answering 200, while the backlog of other campaigns was being read; the log showed nothing. Not
reproduced: 116 later requests, including a second empty data folder polled every second through
the backlog, were all 200. If a player reports a blank first page, start here.

## C. Not in the game

### 14. Storage, computed — resources panel (open task, 2026-10-24)

Without companion mod 0.5.0 the resources panel's storage is ≈ the base. Compute it instead, with a
breakdown like the game's tooltip, from the sources in `docs/storage.md`; check it against the
mod's exact value. Needs: researched techs in the snapshot (`tech_status.technology`: Construction
Templates, Mega-Engineering), our silos (planet zones' `building_resource_silo`, starbase
`resource_silo` — `Station.buildings`), influence left out (it ignores the general modifier), passed resolutions, relics,
civics, bio ships, Dyson gun stage — and an extraction fix: `building_modifier` sums the Resource
Silo's and Subterranean Cache's two blocks into a flat +10,000, dropping the Construction Templates
condition; starbase buildings', resolutions' and relics' storage modifiers are not extracted.

### 8. Releases

The extraction gained tables (starbase parts and levels, market lots, AI data, defines) that the
systems, produce, jobs and trade tabs need. Player zips bundle the extractor from the tag pinned
as `extractorVersion` (`v0.1.0`): release the extraction first (its `RELEASE.md`), bump
`extractorVersion`, then the dashboard (workspace `AGENTS.md`: release order).

### 10. Which empire would accept an embassy, a pact, subjugation — trade tab (idea, 2026-10-23)

Open question: can the trade tab show, per empire, whether it would accept an embassy, each pact
(non-aggression, commercial, research, migration, defensive) and vassalization — and why not? What
the files give (4.5.2 `common/defines/00_defines.txt`, `*_ACCEPTANCE_*`): per action a sum of
opinion × a factor (embassy 0.5, commercial 0.4, research 0.4, NAP 0.2, defensive 0.2, migration
0.5), the AI's attitude (alliance / coexist / other), existing pacts of that kind (−30 or −50 each),
border distance, shared rivals, allies and threat, relative strength; commercial pacts add the
trade value collected (`COMMERCIAL_PACT_ACCEPTANCE_GIVEN/TAKEN_VALUE`), research agreements the
techs one has and the other not; vassalization power difference, pops, loyalty and threat; plus
each action's `AI_acceptance_base_value` in `common/diplomatic_actions/00_actions.txt` (commercial
pact −50). Most inputs are in the save (opinion, attitude, pacts, rivals, relations; distance and
strength need work); the engine may add terms the files do not show, as the trade valuation did.
**Calibrate like trade:** the diplomacy screen's acceptance tooltip per action at a few empires,
against the formula — the files are a starting point, not the answer.

### 9. After the answers come in

- Growth (capacity done): add "what +1 district / a cleared blocker / a medical building / an
  edict gains" and the colony ranking to the growth tab; check the per-slot value on a habitat or
  Gaia world when there is one.
- 4 → `price()` in `#lib/market.ts`.
- 6 → add P for each newly measured resource to `WORTH` (`#lib/aiTrade.ts`) and its tooltips to
  the test; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → the tech tab's "≈ N months at double speed" (stored ÷ base gain) stands if the draw is the base gain.
