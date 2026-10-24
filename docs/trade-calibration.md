# Calibrating the AI's view of a trade

The trade tab predicts what an AI empire would accept, what it gives at most and what a gift does
to its opinion. The game decides all of it in the engine; its files give only some inputs. Every
number below was measured in the campaign on 2026-10-23 (Planetforgers, 2212.08–2213.08, 4.5.2,
no cheats) from the trade screen's acceptance tooltip — set up, not sent — and the saves. The
model is `#lib/aiTrade.ts`; every tooltip line is a case in `aiTrade.test.ts`.

## What we know

**Acceptance.** Our side's worth × the AI's personality's `trade_willingness` (shown beside the
acceptance) minus its side's worth. Nothing else showed in any tooltip: not opinion, trust,
attitude, embassy or pacts (below). An attitude that does not trade (rival, unfriendly — the game
calls it "Suspicious" —, dismissive, hostile, …) makes a deal's acceptance −1000 flat, the only
line in the tooltip ("Suspicious attitude: −1000"; seen 2200.03.01) — but not a gift's.

**A unit's worth** at once, in the tooltip's points: p × base / (base + the AI's **gross**
monthly income of it), p and base fitted per resource (`WORTH`) — not `ai_weight`, not the
defines' income base of 50, not its stockpile, consumption, species, civics, bio ships or market
prices. Linear in the amount, however large; the tooltip rounds down. A unit a month counts
0.5 × the months of one at once (`TRADE_VALUE_RESOURCE_MONTHLY_MULT`), for 10 years as for 30.
An AI takes in at worth only up to **0.8 of its storage** (`room()`, 0.8 × max − its stockpile);
more counts nothing — so into full storage a resource is worth nothing (fallen empires, minerals
at 135,000). A fallen empire's storage is the base + 100,000 (`fallen_empire_base`): 15,000 alloys
counted in full at 2200.03.01. Our own stockpile does not count. Nanites cannot be traded. Measured:
energy, minerals, food, trade, consumer goods, alloys, living metal; the other strategic
resources at game start (p 1/3, base 100, zro 0.31; a throwaway game 2200.03.01, below).

**What it gives at most.** At once its stockpile above max(`ai_wants`, 500)
(`TRADE_MIN_RESOURCE_STOCKPILE`); a month 0.3 × its gross income of it, rounded down
(`TRADE_MAX_RESOURCE_PERCENT`). Nomadic empires never give energy or minerals (their operational
reserves) but take them.

**Gifts.** A one-sided deal raises the AI's opinion of us by its worth at its willingness — the
tooltip's figure or one less ("Favorable Trade Deal", accumulates to 100). Every attitude takes
gifts, rivals and unfriendly empires too: the way to mend one that refuses trades. The files say
the modifier decays 2 (`decay = { base = 2 }`; the save marks it `decay=yes` with its
`start_date`) — **a year, on the gift's anniversary**: Lahtrepian's +41 (a throwaway game, gift
accepted 2201.06.01) held through 2202.05.01 and was 39 from the 2202.06.01 autosave on
(screenshot `~/Pictures/Screenshots/screenshot_2026-10-24_13-11-02`: relations −2 that month).
That is why four months showed nothing, in the campaign too. Open: whether a further gift resets
`start_date`. The AI accepts days to weeks after the offer.

**Drift.** At unchanged income, minerals and food were worth 6–9 % more in each of the first two
half years, then held (2213.08–2214.01: no step, ~1 % down at most) (food 0.067 → 0.078 → 0.082 a unit at KhellZen, 2212.08 → 2213.02 → 2213.08), energy rose 10 %
and then held, the advanced resources never moved. Cause unknown (ruled out below); the model holds
the latest level (2213.08), the test checks older lines at their date's level (`LEVEL`).

**What else counts, from the files** (none of it showed in a trade tooltip; 13 empires from
opinion −504 to +440, trust 0–81, with and without embassy, commercial, research, migration and
defensive pacts fitted income and willingness within 2.3 %):

- _Attitude_ is the AI's own pick (from opinion, threat, personality); it gates deals (−1000), so
  opinion and trust act only through it. _Willingness_ is fixed by personality; nothing in
  `common/` changes it.
- _Embassy_: +0.10 trust a month (`MONTHLY_TRUST_EMBASSY`), envoys improve relations 3× as fast,
  +20 intel.
- _Trust_ builds from pacts (0.10–1.00 a month; capped at 50–100 by the pact) and enters opinion.
- _Commercial pact_: each side gets 10 % of the other's trade production
  (`COMMERCIAL_PACTS_INCOME_PERCENTAGE`) — more gross trade income, so trade is worth a little less
  to it — and +0.25 trust a month.
- _Running deals_: if their payments count as income, they cheapen that resource for the next
  deal (not checked). A deal ends when a side cannot pay at the end of a month (seen in game: "the
  other empire can't afford the monthly rate of resource X"); breaking one costs opinion
  (`opinion_was_in_trade`, 0.5 × the deal's value, `BROKEN_TRADE_DEAL_FACTOR`).
- _Favors_ can go into a deal (`TRADE_VALUE_FAVORS_MULT` = 10 × a favor's acceptance value; the
  value is not in the defines).
- _Pacts and embassies themselves_ have acceptance formulas of their own (opinion × 0.2–0.5,
  attitude, existing pacts, distance, shared rivals and threat, strength) — `docs/open-checks.md`
  item 10.

**Strategy: pay once, receive monthly.** Since a unit a month counts half, paying at once for a
monthly payment returns twice a swap's units over the deal, the same total for any length — take
10 years, it arrives soonest. Mixing is the only lever: monthly for monthly and at once for at
once trade at the same rate, and the reverse (their lump sum for our monthly payment) costs us
double. Held to their monthly cap. The risks: the deal breaks when they cannot afford the
payment (the deal finder's monthly mode shows their net income after paying and how long their
stockpile lasts), the lump is gone if it breaks, and the return comes spread over 10 years
(doubling over 10 years paid evenly ≈ 13–14 % a year).

**Open:** the drift's cause; strategic resources (nomad game); whether the galactic market
changes any of it; when exactly a deal breaks (zero stockpile or negative net); the storage
modifiers an AI's room depends on; the acceptance of embassies, pacts and subjugation. All in
`docs/open-checks.md`.

## Paused (2026-10-23) — where to pick it up

The topic is paused; the campaign is kept to come back to it. The general findings are written up for
other modders in `stellaris-modding-insights` (docs 16 and 17).

- **Campaign:** `pyrragthulplanetforgers_-2145618317` (Linux, Proton), last measured at
  2214.01.01. Manual saves of measured moments: `2212.08.02_after_energy_gifts`,
  `2213.01.02_mineral_gifts_offered`, `2213.02.01_trade_deal_checks`, `2213.08.01_trade_checks`,
  `2214.01.01_resolution_passed`; screenshots in `~/Pictures/Screenshots` (desktop tool,
  2026-10-23 13:22–19:23), not the game's own folder. Its dashboard DB is the `-test` one (the
  auto-memory on this machine names it).
- **Reference empires:** KhellZen Republic (`16777227`, federation_builders 0.95, rich: energy
  13,000+, food 11,000) and Lolehndra Galactic League (`16777219`, our subject, hegemonic
  imperialists 0.8, poor: every stockpile under 1,200). Measuring both separates income effects
  from storage room. The monthly series ran 2213.08–2214.01: seven resources at once, 1000 each
  (10,000 at 2214.01).
- **Reading an AI's economy from a save:** gross income = `country.<id>.budget.current_month.income`
  summed over sources (net = `balance`), stockpile = `modules.standard_economy_module.resources`;
  `intelOf()` reads both (`AiIntel.income`, `net`, `stockpile`). Unzip the `.sav` into `$TMPDIR`
  and parse `gamestate` with the dashboard's `jomini`; the `aiIntel` in the DB has it too.
- **Checking a new number:** `aiValue()` × amount (`worthOf()` where room matters) ×
  willingness against the tooltip; add it as a dated case to `aiTrade.test.ts` (older dates at
  their `LEVEL`). Refit `WORTH` only with several empires at one date.
- **Ideas not yet tried for the drift:** the AI's war/peace or threat state; tech count (tech
  power rose 372 → 385 at KhellZen); a per-year AI recalculation
  on the anniversary of something (game start 2200.01.01? KhellZen's first contact?). Ruled out:
  the galactic market's founding (2026-10-24: the same shift a month before it).

## The original session plan (2026-10-22, superseded)

Planned as a throwaway-game session with cheats; done instead in the campaign without cheats,
from tooltips (results below). Kept for its offer list.

### Setup

1. New game, small galaxy, 8+ AI empires, **no** `debug_yesmen`. Play until 2200.02.01.
2. Console: `contact`, `communications` (meet everyone), `debugtooltip` (ids in tooltips).
3. Give yourself plenty: `cash 50000`, `minerals 50000`, `alloys 20000`,
   `consumer_goods 20000`, `food 20000`, `resource volatile_motes 500` (forms: AGENTS.md → "Testing in a throwaway game").
4. Start the dashboard against a **separate** DB (`DASHBOARD_DB=$TMPDIR/trade/dashboard.sqlite`)
   with the trade tab's `tradeIntel` switch on (⚙), so each manual save shows the AIs' stockpiles.
5. Pick **three empires with different personalities** (the diplomacy screen names it), e.g. a
   trader (1.0), an explorer (0.9) and a hegemonist (0.8), all with a trading attitude
   (neutral, wary, receptive, cordial, friendly, …). Write their names below.

| Empire | Personality | Attitude | Opinion of us |
| ------ | ----------- | -------- | ------------- |
|        |             |          |               |
|        |             |          |               |
|        |             |          |               |

### 1. Acceptance (≈ 20 offers)

**Save manually before each empire's batch** (the dashboard reads their stockpile from it).
For each offer build it in the trade screen and note the **acceptance number** it shows — do
**not** send it. The deal length stays at its default (10 years) unless a row says otherwise.

| #   | Empire | We give                                                       | They give       | Length | Acceptance |
| --- | ------ | ------------------------------------------------------------- | --------------- | ------ | ---------- |
| 1   | A      | 100 energy                                                    | —               | —      |            |
| 2   | A      | 500 energy                                                    | —               | —      |            |
| 3   | A      | 100 alloys                                                    | —               | —      |            |
| 4   | A      | —                                                             | 100 energy      | —      |            |
| 5   | A      | 100 alloys                                                    | 400 energy      | —      |            |
| 6   | A      | 100 alloys                                                    | 400 minerals    | —      |            |
| 7   | A      | 10 energy/month                                               | —               | 10 y   |            |
| 8   | A      | 10 energy/month                                               | —               | 30 y   |            |
| 9   | A      | 5 alloys/month                                                | 20 energy/month | 10 y   |            |
| 10  | A      | 200 consumer goods                                            | 400 energy      | —      |            |
| 11  | A      | 20 volatile motes                                             | 400 energy      | —      |            |
| 12  | B      | 100 alloys                                                    | 400 energy      | —      |            |
| 13  | B      | 500 energy                                                    | —               | —      |            |
| 14  | B      | 10 energy/month                                               | —               | 10 y   |            |
| 15  | C      | 100 alloys                                                    | 400 energy      | —      |            |
| 16  | C      | 500 energy                                                    | —               | —      |            |
| 17  | C      | 10 energy/month                                               | —               | 10 y   |            |
| 18  | A      | find the most energy A gives for 100 alloys at acceptance ≥ 0 |                 | —      | (energy)   |
| 19  | B      | the same                                                      |                 | —      | (energy)   |
| 20  | C      | the same                                                      |                 | —      | (energy)   |
| 21  | A      | 100 trade                                                     | —               | —      |            |
| 22  | A      | 100 trade                                                     | 100 energy      | —      |            |
| 23  | N      | —                                                             | 100 energy      | —      |            |
| 24  | N      | —                                                             | 100 minerals    | —      |            |

Rows 1–4 and 12–17 isolate one resource's value per empire; 5–6, 10–11 the exchange rates;
7–9 how monthly payments and length count; 18–20 the break-even rate directly.
21–22 trade's own worth (no `ai_weight` in the files: the model's `tradeWeight` guess is 1). N
is a **nomadic** empire (marked on the trade tab): 23–24 whether it can put energy or minerals
into a deal at all — the model assumes not, as on the market (note "not offered" if the trade
screen does not list them).

### 2. Gifts and opinion

With empire A: save, then **send** gifts one at a time (a one-sided deal) and after each note
the opinion breakdown's "Favorable Trade Deal" line (hover their opinion), then save.

| #   | Gift        | Favorable Trade Deal | Opinion of us |
| --- | ----------- | -------------------- | ------------- |
| 0   | (before)    |                      |               |
| 1   | 100 energy  |                      |               |
| 2   | 500 energy  |                      |               |
| 3   | 100 alloys  |                      |               |
| 4   | 2000 energy |                      |               |

Then `fast_forward 30` twice and note the line each time (the decay; expected −2 a month).

### 3. An attitude that does not trade

If any empire shows unfriendly, rival, hostile, domineering or threatened: one offer (row 1's)
to it, its acceptance.

## Results, measurement by measurement

### 2026-10-23: one empire in the campaign (no cheats)

KhellZen Republic in `autosave_2212.08.01` — federation_builders (willingness 0.95, shown as 95 %
beside the acceptance), friendly, opinion 240. It offers energy a month, we give one resource a
month, 10 years, nothing sent. Rows: the least we give that it still accepts; the tooltip where
there was one. Its economy from the save: energy 13,063 (net +95.2, gross 181.9), minerals 346
(+40.6), food 9,864 (+64.9), consumer goods 3,122 (+28.8), alloys 261 (+17.5), trade 1,108
(+57.2), living metal 119 (0).

| We give a month   | It gives a month | Tooltip (ours / theirs / acceptance) |
| ----------------- | ---------------- | ------------------------------------ |
| 46 minerals       | 50 energy        | —                                    |
| 33 food           | 50 energy        | —                                    |
| 48 trade          | 50 energy        | —                                    |
| 25 consumer goods | 50 energy        | —                                    |
| 17 alloys         | 50 energy        | —                                    |
| 5 living metal    | 36 energy        | +90 / −89 / 1                        |
| 17 food           | 25 energy        | +64 / −62 / 2                        |
| 9 alloys          | 25 energy        | +67 / −62 / 5                        |
| —                 | 55 energy        | −1000: "wants to trade away less"    |

Then food a month from it, and one-off deals (same date):

| We give                                  | It gives                                      | Tooltip (ours / theirs / acceptance)                  |
| ---------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| 60 energy a month                        | 35 food a month                               | +142 / −140 / 2                                       |
| 52 minerals a month                      | 35 food a month                               | +143 / −140 / 3                                       |
| 50 trade a month                         | 32 food a month                               | +131 / −128 / 3                                       |
| 28 consumer goods a month                | 35 food a month                               | +145 / −140 / 5                                       |
| 19 alloys a month                        | 35 food a month                               | +141 / −140 / 1                                       |
| 5 living metal a month                   | 22 food a month                               | +90 / −88 / 2                                         |
| 1000 minerals, food, alloys, 50 l. metal | 12,563 energy, 608 trade, 2,622 consumer g.   | +46, +63, +124, +15 / −522, −28, −238 / −541          |
| 1000 energy                              | 9,363 food                                    | +39 / −627 / −588                                     |
| —                                        | 12,564 energy (+1 minerals, alloys, d. m., …) | −1000: less energy, minerals, trade, CG, alloys, d.m. |
| —                                        | 9,364 food                                    | −1000: less food                                      |

What it settles (in `#lib/aiTrade.ts` with these numbers as its test):

- The acceptance is our offer's worth × its willingness (0.95: energy 142/60 against 89/36, food
  64/17 against 140/35, trade and consumer goods alike) minus its offer's worth; nothing for
  attitude or opinion beside them. (A first reading of the monthly rows alone took willingness for
  no term; the received/given pairs show it.)
- Worth is linear in the amount and does not saturate: 1000 alloys at once (124) count per unit
  what 9 a month do (67 / 120 / 0.5). A unit a month = 0.5 × the months × a unit at once
  (TRADE_VALUE_RESOURCE_MONTHLY_MULT), for every resource here.
- It gives at once at most its stockpile above max(`ai_wants`, `TRADE_MIN_RESOURCE_STOCKPILE` 500):
  energy 13,063 → 12,563, food → 9,363, trade (no `ai_wants`) 1,108 → 608, consumer goods → 2,622;
  minerals (346, want 1000), alloys (261) and dark matter (24, want 5) not even 1.
- It pays at most `TRADE_MAX_RESOURCE_PERCENT` (0.3) of its gross monthly income a month, rounded
  down: 54 of 181.9 energy (55 → −1000). We could give no more living metal than our income (5.25).

### 2026-10-23: a second empire

Lolehndra Galactic League (our subject), same save — hegemonic_imperialists (willingness 0.80),
loyal. Its economy: energy 869 (net +37.3), minerals 901 (+25.0), food 625 (+50.6), trade 1,079
(+8.8), consumer goods 538 (+11.5), alloys 489 (+18.6), no living metal.

| We give a month   | It gives a month | Tooltip (ours / theirs / acceptance) |
| ----------------- | ---------------- | ------------------------------------ |
| 57 energy         | 31 food          | +132 / −130 / 2                      |
| 54 minerals       | 31 food          | +131 / −130 / 1                      |
| 37 trade          | 31 food          | +131 / −130 / 1                      |
| 30 consumer goods | 31 food          | +133 / −130 / 3                      |
| 21 alloys         | 31 food          | +131 / −130 / 1                      |
| 5 living metal    | 18 food          | +76 / −75 / 1                        |

### 2026-10-23: a fallen empire

Syvaal Forerunners, same save — fallen_empire_xenophile (willingness 0.50). Its economy (stockpile,
gross income a month): energy 88,898 (4,571), minerals 135,000 (2,679), food 135,000 (3,113), trade
38,739 (1,101), consumer goods 132,380 (1,190), alloys 29,132 (561), living metal 664 (22). Its
storage is 100,000 more than ours (`fallen_empire_base`: `country_resource_max_add`), so minerals
and food are full but energy only at ~60 %.

| We give a month   | It gives a month | Tooltip (ours / theirs / acceptance) |
| ----------------- | ---------------- | ------------------------------------ |
| 161 energy        | 50 minerals      | +19 / −18 / 1                        |
| 113 food          | 50 minerals      | +19 / −18 / 1                        |
| 50 trade          | 50 minerals      | +19 / −18 / 1                        |
| 36 consumer goods | 50 minerals      | +19 / −18 / 1                        |
| 19 alloys         | 50 minerals      | +19 / −18 / 1                        |
| 5 living metal    | 104 minerals     | +39 / −38 / 1                        |
| 178 energy        | 10 alloys        | +21 / −20 / 1                        |
| 113 minerals      | 10 alloys        | +21 / −20 / 1                        |
| 125 food          | 10 alloys        | +21 / −20 / 1                        |
| 50 trade          | 9 alloys         | +19 / −18 / 1                        |
| 40 consumer goods | 10 alloys        | +21 / −20 / 1                        |
| 5 living metal    | 19 alloys        | +39 / −38 / 1                        |

Willingness holds here too: 19 of our alloys a month +19, 19 of its −38.

### 2026-10-23: gifts of 1000 energy

To every other empire, proposed 2212.08.01; the AIs accepted on different days through August
(12th, 20th, 29th, …). The acceptance's figure ("Our Offer Total") against the "Favorable Trade
Deal" in the 2212.09.01 autosave, with the empire's willingness and gross energy income:

| Empire          | Willingness | Gross energy | Tooltip | Opinion |
| --------------- | ----------- | ------------ | ------- | ------- |
| test nomads     | 0.95        | 139          | 43      | 42      |
| Ikaanan         | 0.75        | 110          | 36      | 36      |
| Dekron          | 0.9         | 337          | 27      | 27      |
| Lolehndra       | 0.8         | 118          | 38      | 37      |
| YlKhahan        | 0.7         | 107          | 34      | 33      |
| Cydran          | 1.0         | 240          | 36      | 35      |
| Karkato         | 0.25        | 118          | 12      | 11      |
| Landless Kobar. | 1.0         | 113          | 48      | 47      |
| Oklarran        | 0.9         | 37           | 54      | 53      |
| Mandate Dekrus  | 0.5         | 189          | 20      | 19      |
| Hydarian        | 0.8         | 155          | 35      | 34      |
| KhellZen        | 0.95        | 182          | 39      | 38      |
| Themlaran       | 0.75        | 140          | 34      | 33      |
| Syvaal (fallen) | 0.5         | 4,571        | 1       | none    |
| Ti-Zru (fallen) | 0.33        | 4,423        | 0       | none    |

A gift buys its worth to them at their willingness in opinion: the tooltip or one less. Ti-Zru's
acceptance showed a line "Gift: +1" of its own. **No decay**: the 2213.01.02 save shows every one of
these values unchanged, four months on (the files: −2 a month).

### 2026-10-23: gifts of 1000 minerals

Proposed 2213.01.02 to every other empire; the rise of the "Favorable Trade Deal" by the 2213.02.01
autosave (— capped at 100, or not accepted yet):

| Empire          | Willingness | Gross minerals | Tooltip | Rise |
| --------------- | ----------- | -------------- | ------- | ---- |
| test nomads     | 0.95        | 0              | 71      | —    |
| Ikaanan         | 0.75        | 92             | 40      | 39   |
| Dekron          | 0.9         | 179            | 38      | 37   |
| Lolehndra       | 0.8         | 84             | 44      | 43   |
| YlKhahan        | 0.7         | 0              | 52      | 51   |
| Cydran          | 1.0         | 123            | 49      | 48   |
| Karkato         | 0.25        | 117            | 12      | 11   |
| Landless Kobar. | 1.0         | 0              | 74      | —    |
| Oklarran        | 0.9         | 0              | 67      | —    |
| Mandate Dekrus  | 0.5         | 117            | 25      | —    |
| Hydarian        | 0.8         | 0              | 59      | 58   |
| KhellZen        | 0.95        | 102            | 50      | 49   |
| Themlaran       | 0.75        | 103            | 39      | —    |
| Syvaal (fallen) | 0.5         | 2,679          | 0       | none |
| Ti-Zru (fallen) | 0.33        | 4,712          | 0       | none |

The nomads (no mineral income) all put a unit at 0.0744 at once — the curve's p, measured
directly. The fallen empires, both at 135,000 minerals (their full storage), valued it at **0**:
a gift into full storage is worth nothing — though they had counted 113 minerals a month at 0.0062
a unit (2212.08). At KhellZen and Lolehndra, minerals came out 8 % higher than in their 2212.08
deals, at nearly the same income and stockpile — unexplained.

### 2026-10-23: deal length, and a fourth empire

Cybernetic Ikaanan Principality, `autosave_2213.02.01` — evangelising_zealots (willingness 0.75),
gross income: food 85.9, trade 55.5, consumer goods 56.7, alloys 26.8, no living metal. Nothing
sent; "Our Offer Total":

| We give                   | Tooltip |
| ------------------------- | ------- |
| 10 food a month, 10 years | 40      |
| 10 food a month, 30 years | 122     |
| 1,200 food at once        | 81      |
| 3,600 food at once        | 244     |
| 1,000 food                | 67      |
| 1,000 trade               | 50      |
| 1,000 consumer goods      | 73      |
| 1,000 alloys              | 94      |
| 108 living metal          | 25      |

**Length:** a unit a month counts 0.5 × the months of a unit at once at 30 years as at 10 (40 ≈ 81
/ 2, 122 = 244 / 2) — no discount for later months. Tooltips round down (1,000 → 67, 1,200 → 81,
3,600 → 244: 0.0678 a unit).

**Out of sample:** trade, consumer goods, alloys and living metal fell within 3 % of the curves
fitted to the first three empires (now refitted on four). Food came out 16 % above: Ikaanan, at 86
food a month, values it 28 % above Lolehndra at 105 — no p × base / (base + gross) fits the four
points better than ±12 %, nor net income, stockpile or upkeep. Something else moves food's worth.

### 2026-10-23: two more empires (2213.02.01)

1000 (living metal 108) at once, nothing sent; "Our Offer Total", with gross income a month:

| Resource       | Cydran (1.0) | Dekron (0.9) |
| -------------- | ------------ | ------------ |
| food           | 132 (21.5)   | 129 (0)      |
| trade          | 38 (238)     | 43 (156)     |
| consumer goods | 95 (63)      | 75 (101)     |
| alloys         | 121 (33)     | 110 (32)     |
| living metal   | 33 (0)       | 30 (0)       |

Fitted on the first three empires, trade, consumer goods, alloys and living metal predicted
Ikaanan, Cydran and Dekron within 2.4 % — the form holds. Food did not: refitted on all six it
leaves ±12 %, its 2212.08 points (KhellZen, Lolehndra) ~9 % under the curve and its 2213.02 ones
~8 % over — the same direction as minerals between 2212.08 and 2213.01. Something that changed in
those months moves the basic resources; not the empires' own market prices (Dekron's alloys at
+50 % fit within 0.2 %).

### 2026-10-23: food at every empire (2213.02.01)

1000 food at once, nothing sent; "Our Offer Total" with gross food income (willingness):

| Empire             | Gross food | Tooltip | Empire       | Gross food | Tooltip   |
| ------------------ | ---------- | ------- | ------------ | ---------- | --------- |
| YlKhahan (0.7)     | 100        | 59      | Themlaran    | 102        | 62 (0.75) |
| Karkato, bio (.25) | 77         | 23      | Hydarian bio | 142        | 56 (0.8)  |
| KhellZen (0.95)    | 118        | 74      | test nomads  | 87         | 85 (0.95) |
| Kobarian (1.0)     | 114        | 79      | Ikaanan      | 86         | 67 (0.75) |
| Lolehndra (0.8)    | 105        | 66      | Cydran       | 21.5       | 132 (1.0) |
| Mandate (0.5)      | 0          | 72      | Dekron       | 0          | 129 (0.9) |
| Oklarran (0.9)     | 20         | 120     |              |            |           |

At one date food is clean: p × 130 / (130 + gross) fits all 13 at 2 % rms (worst 4 %; an
exponential or a power do no better). Bio ships make no difference (Karkato −1 %, Hydarian −2 %).
The earlier ±12 % was the **drift**: at the same income KhellZen (117.9 → 118.1) and Lolehndra
(105.0 → 104.8) valued food 17 % lower in 2212.08 than now; the fallen Syvaal's 2212.08 food sits
6 % under. Food now uses the 2213 curve (p 0.1485, base 130); the test asserts the 2212.08 offset.

### 2026-10-23: the drift, checked (`2213.02.01_trade_deal_checks.sav`)

1000 energy and 1000 alloys at the empires measured in 2212.08, nothing sent:

| Empire    | Energy 2212.08 → now (gross) | Alloys 2212.08 → now (gross) |
| --------- | ---------------------------- | ---------------------------- |
| KhellZen  | 39 → **43** (181.9 → 182.7)  | 124 → 122 (21.37 → 21.37)    |
| Lolehndra | 38 → **42** (118.2 → 119.5)  | — → 103 (model: 103.4)       |

Energy rose 10 % at both at the same income; alloys did not move. So the drift hits the **basic
resources** — energy +10 %, minerals +9 %, food +17 % — and not the advanced ones. The defines give
energy and minerals a valuation of their own (`TRADE_VALUE_RESOURCE = 2`, "for minerals and energy
(scaled by income & need)"); the "need" is engine state, not in the save. Energy is refitted to the
2213 level (p 0.0747 — now level with minerals' 0.0733, as the defines' shared value suggests); the
test scales every 2212.08 line by that date's level (`AT_2212_08`). The fallen Syvaal's energy
drifted the same; its minerals not, its food 6 %.

### 2026-10-23: a year and a half on (`autosave_2213.08.01`)

KhellZen and Lolehndra again, all at once, nothing sent ("Our Offer Total", 1000 each, living
metal 145):

| Resource       | KhellZen | Lolehndra | Model (2213.02 curves) |
| -------------- | -------- | --------- | ---------------------- |
| energy         | 42       | 42        | +2 % / 0 %             |
| minerals       | 53       | 47        | −8 % / −8 %            |
| food           | 78       | 70        | −5 % / −6 %            |
| trade          | 43       | 59        | +1 % / +2 %            |
| consumer goods | 86       | 74        | +2 % / +2 %            |
| alloys         | 122      | 102       | +1 % / +1 %            |
| living metal   | 43       | 36        | +1 % / +1 %            |

Incomes as in 2213.02 within a few units. Unit worth at once over time, same empires:

|                           | 2212.08         | 2213.01–02      | 2213.08         |
| ------------------------- | --------------- | --------------- | --------------- |
| KhellZen minerals / food  | 0.0483 / 0.0667 | 0.0526 / 0.0779 | 0.0558 / 0.0821 |
| Lolehndra minerals / food | 0.0505 / 0.0697 | 0.0550 / 0.0825 | 0.0588 / 0.0875 |
| energy (tooltip, both)    | 39 / 38         | 43 / 42         | 42 / 42         |

Minerals and food keep rising (~6–8 % a half year); energy has stopped; the rest never moved. The
model now holds 2213.08 (minerals p 0.0795, food 0.1574); the test checks every older line at its
date's level (`LEVEL` in `aiTrade.test.ts`).

### 2026-10-23: the monthly series (KhellZen and Lolehndra, all at once, nothing sent)

| Date    | KhellZen: energy, minerals, food, trade, CG, alloys, living metal | Lolehndra: the same                              |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| 2213.08 | 42, 53, 78, 43, 86, 122, 43 (145)                                 | 42, 47, 70, 59, 74, 102, 36 (145)                |
| 2213.09 | 42, 53, 77, 43, 86, 122, 45 (151)                                 | 42, 47, 69, 59, 74, 102, 37 (151)                |
| 2213.10 | 42, 52, 77, 43, 86, 122, 47 (158)                                 | 42, 47, 69, 59, 74, 102, 39 (158)                |
| 2213.11 | 42, 52, 77, 44, 85, 120, 48 (164)                                 | 42, 46, 69, 60, 74, 102, 41 (164)                |
| 2213.12 | 42, 52, 77, 44, 85, 120, 50 (170)                                 | 42, 46, 68, 61, 74, 102, 42 (170)                |
| 2214.01 | 10,000 each: 273, 522, 78, 444, 714, 1202, 2980                   | 10,000 each: 422, 465, 683, 617, 746, 1021, 2509 |

Incomes unchanged within 0.2; every value within 2.6 % of the model. **No drift in these two
months** — food 78 → 77 and KhellZen's minerals 53 → 52 are the tooltip rounding down (the model
puts minerals at 53.0, on the boundary); living metal is the same per unit. 2213.11: KhellZen's alloy, consumer goods and trade income
moved (21.4 → 24.1, 69.6 → 75.0, 174.7 → 166.6) and its values with them, as the model predicts
(all 14 within 2.9 %); Lolehndra's minerals 47 → 46 at the same income (model 47.1) — rounding,
or the first step down. 2213.12: Lolehndra's food 69 → 68 at the same income, its trade 60 → 61
with its trade income (31.4 → 25.9). Since 2213.08 the basic resources have only lost points
(minerals 53 → 52 and 47 → 46, food 78 → 77 and 70 → 68): 1–3 % in four months, at the
tooltip's resolution (a point ≈ 2 %). **Offer 10,000 minerals and food** for ten times the
resolution.

2214.01 (10,000 of each, a month after we filled our own storage by console): **our stockpile
changed nothing** — Lolehndra's values, all linear, are the 2213.12 ones ×10 within 1 %. KhellZen's
energy, food and consumer goods came out far under ×10: an AI **takes in at worth only up to 0.8 of
its storage** — energy 0.8 × 25,000 − 13,621 = 6,379 units (worth 275, tooltip 273), food 1,026
(80, 78), consumer goods 8,377 (720, 714); every other line linear. At ten times the resolution
the basic resources sit ~1.2 % under the 2213.08 level (KhellZen minerals 52.2 per 1000, model
52.9; Lolehndra minerals 46.5 / 47.0, food 68.3 / 69.2): no step since 2213.08, at most a slow
fall. With 6–9 % over each earlier half year, the drift comes in
steps rather than smoothly — the months it steps, compared save to save, should show its cause.

### 2026-10-23: a throwaway game at 2200.03.01 (strategic resources, and the curves at game start)

Throwaway game `yorphianextractorate_888024433` (we are a Machine Intelligence: Shroud-Forged,
Entropy Drinkers, Factory Overclocking; resources from the console). Manual save `2200.03.01`;
screenshots `~/Pictures/Screenshots/screenshot_2026-10-23_23-51-28` … `23-53-44` (two per empire:
basics, strategic). 1000 of each at once, nothing sent. Empires matched to the save by the
willingness the screen shows (`personality.trade_willingness`):

| Empire (id, personality, w)                                               | energy | minerals | food | trade | consumer goods | alloys | motes, gases, crystals, living metal, dark matter | zro |
| ------------------------------------------------------------------------- | ------ | -------- | ---- | ----- | -------------- | ------ | ------------------------------------------------- | --- |
| Wandering Andarian Wayfarers (16777220, ruthless_capitalists, 1.0, nomad) | 52     | 0        | 92   | 45    | 146            | 170    | 333                                               | 308 |
| Lahtrepian Hierarchy (9, hegemonic_imperialists, 0.8)                     | 48     | 53       | 85   | 45    | 121            | 141    | 266                                               | 246 |
| Nomadic Buhavilaan Unity (16777226, hive_mind, 0.7, nomad)                | 36     | 0        | 67   | 28    | 96             | 116    | 233                                               | 216 |

Against `WORTH` (game ÷ model, incomes from the save):

- **Energy and minerals fit** (0.98–1.00), food is 3–4 % over: the 2213.08 curves hold at game start.
- **Minerals 0 at both nomads is room, not nomadism**: they hold 14,926 and 14,888 of 15,000
  (room = 0.8 × max − stockpile = 0). Both still value energy (they hold ~1,060).
- **Off by a level, the same at all three:** alloys × 1.25–1.27, trade × 0.79–0.85, consumer goods
  × 1.42–1.44 (the hive mind × 1.09: it has no consumer goods and no income of them, so it does not
  value them like the others). The campaign held these three steady from 2212.08 to 2214.01. So
  their level changes at some point, while minerals, which drifted in the campaign, start where
  2213.08 ended: the drift is not game time alone.
- **Strategic resources: 1/3 per unit × willingness**, at every empire alike. None of the three has
  any stockpile or income of them. Zro is 0.308 (× 0.925) for a reason not known yet. Living metal is
  0.333 here at no income, against `WORTH`'s p = 0.3144 from the campaign (2212–2213): 6 % higher.

Same date, more empires (screenshots `screenshot_2026-10-24_00-00-00` … `00-03-27`): the two fallen
empires, both **dismissive** and at willingness 0.5 — Barcalan Conservers (14,
fallen_empire_materialist) and Evaritan Progenitors (16777229, fallen_empire_xenophile), matched
by their minerals line — plus Avallonian Corporate Union (16777223, ruthless_capitalists, 1.0,
**unfriendly**, −80). Avallonian's strategic line was the same as Andarian's (333, zro 308).

| Empire        | energy | minerals | food | trade | consumer goods | alloys | motes | gases | crystals | living metal, dark matter | zro | 10,000 energy |
| ------------- | ------ | -------- | ---- | ----- | -------------- | ------ | ----- | ----- | -------- | ------------------------- | --- | ------------- |
| Barcalan (FE) | 2      | 4        | 3    | 8     | 14             | 24     | 71    | 73    | 73       | 142                       | 133 | 21            |
| Evaritan (FE) | 2      | 3        | 2    | 6     | 10             | 18     | 65    | 63    | 64       | 136                       | 128 | 20            |
| Avallonian    | 53     | 65       | 105  | 48    | 138            | 170    | 333   | 333   | 333      | 333                       | 308 | —             |

- **Strategic resources: p = 1/3, base B = 100** (zro p 0.31), solved at both fallen empires for
  each resource alone (B 98–100). Now in `WORTH` with tests.
- **The basic resources at game start, refitted on all six empires** (four normal, two fallen
  empires; every tooltip within its rounding), against the campaign's `WORTH`:

  | resource       | p, B at 2200.03 | campaign (2213.08) |
  | -------------- | --------------- | ------------------ |
  | energy         | 0.0768, 241     | 0.0747, 280        |
  | minerals       | 0.0811, 219     | 0.0795, 240        |
  | food           | 0.191, 91       | 0.1574, 130        |
  | trade          | 0.0674, 236     | 0.0884, 185        |
  | consumer goods | 0.197, 124      | 0.1253, 195        |
  | alloys         | 0.190, 128      | 0.1468, 165        |

  Energy and minerals hardly differ. The rest have a different curve, not just a different scale.
  `WORTH` keeps the campaign's values, because the campaign is what the tab is used on.

- **No −1000 for dismissive or unfriendly — but every one of these offers was a gift** (one-sided),
  and gifts never carry it. The two-sided deal is still owed.
- **10,000 energy to a fallen empire: 21 and 20**, ≈ 10 × the 1000 line. At about 0.002 a unit
  the tooltip's rounding cannot show where the room ends. Use a resource the fallen empire values
  more, e.g. alloys: Barcalan holds 308, so 0.8 × 15,000 leaves 11,700 of room at base storage.

Two-sided deals and fallen-empire storage (screenshots `screenshot_2026-10-24_00-09-07` …
`00-10-13`, same date):

- **1000 alloys for 1 energy: −1000 flat** at Avallonian ("Suspicious attitude: −1000") and at
  Barcalan ("Dismissive attitude: −1000"). There are no offer totals: the attitude replaces the sum
  rather than adding to it. `terms()` already refuses such empires.
- **Alloys to Barcalan: 10,000 → 241, 15,000 → 362** (× 1.50, linear). At base storage the room
  would end at 11,692 (0.8 × 15,000 − 308) and 15,000 would show about 282. So its storage is
  above the base, as `fallen_empire_base`'s +100,000 gives. `room()` now adds that for fallen
  empires (test from these numbers).
- Nanites are not tradable (the trade screen does not list them; extraction `tradable = 0`).

### 2026-10-24: the same game with the galactic market founded (2201.05.01)

The market founded from the console (`AGENTS.md` → Testing in a throwaway game), no resolution.
Manual save `2201.05.01`; screenshots `~/Pictures/Screenshots/screenshot_2026-10-24_12-35-43` …
`12-37-12`. 1000 at once, nothing sent; predicted from the 2200.03 game-start fit at the save's
incomes:

| Empire (w)       | energy      | minerals | food    | trade       | consumer goods | alloys    | strategic           |
| ---------------- | ----------- | -------- | ------- | ----------- | -------------- | --------- | ------------------- |
| Andarian (1.0)   | **46** / 51 | 0 / 0    | 91 / 91 | **45** / 43 | 142 / 142      | 166 / 166 | 333, zro 308 — same |
| Lahtrepian (0.8) | **42** / 47 | 53 / 53  | 82 / 82 | **46** / 44 | 119 / 119      | 140 / 140 | 266, zro 246 — same |

Energy × 0.89–0.90 at both, trade × 1.04–1.05; everything else exact.

**The control — the month before, no market** (`autosave_2201.04.01` loaded; screenshots
`screenshot_2026-10-24_12-40-24`, `12-40-55`; predicted at that save's incomes): energy 46 / 51.3
and 42 / 47.8 (× 0.90, × 0.88), trade 45 / 43.0 and 47 / 44.9 (× 1.05) — the same shift. **The
galactic market changes nothing an AI values**; energy and trade drifted between 2200.03 and
2201.04 by themselves — energy down, where the campaign's rose 10 %.

### What does not explain food (and the minerals drift), 2026-10-23

- **Consumption:** Dekron (machine, no food income or upkeep at all) values food highest
  (0.144 a unit); Cydran (machine) uses food only for its Anglers artisans. Organic, cyborg and
  machine empires scatter alike around the curve.
- **Bio ships** (`country_uses_bio_ships`: shipsets `biogenesis_01|02`, `biogenesis_01_fallen_empire`;
  +10,000 food storage, ships and components cost food): only Karkato and Hydarian use them,
  neither measured for food yet.
- **Catalytic processing:** no empire in this galaxy has it.
- **The drift is outside the empire's economy:** Lolehndra's minerals at 2212.08 and 2213.01 —
  gross 84.4 and 84.3 from the same sources, upkeep 59.4 both times — came out 0.0505 and 0.0550
  (+9 %); KhellZen's +9 % too, its stockpile up (346 → 453) where Lolehndra's fell (901 → 626).
  Not the AI's `ai_resource_target_records` (unchanged), not our economy (unchanged), not their
  market prices. Trade, consumer goods and alloys do not drift: fitted on 2212.08, they predicted
  2213.02 within 2.4 %. So far the drift is a basic-resource (minerals, food) effect; energy is
  unmeasured after 2212.08.
- **Their own economy:** KhellZen across 2212.08 → 2213.08 — pops 5,931 → 5,915, economy power
  665 → 667, empire size 102 → 103, minerals and food income unchanged — while its minerals rose
  16 % and food 23 %. Not size, not growth.
- **The AI's economic plans** (`common/economic_plans/`, `inline_scripts/ai/ai_base*.txt`): the
  save's `ai_resource_target_records` (energy 10, minerals 25, food 10, alloys 20, …) are the base
  plan's income targets (`@economic_plan_*_target`) — fixed, hence unchanged. The plan's scaling
  subplans raise targets for exactly energy (+10), minerals (+10) and food (+20) a pass, while the
  income is under 40 / 50 / 50 and the stockpile under 25,000 — a "need" that grows at constant
  income. It does not fit: KhellZen's food (net 65, scaling off) rose most, Lolehndra's energy (net
  27–37, scaling on) stopped rising. Which plan an empire is on is not in the save.
- **The galaxy's economy** (summed over every empire's gross and net income and stockpile per
  resource, with and without us, and the regular AIs alone; indexed to 2212.08): food and
  minerals moved at most 6 % where their worth rose 16–24 %; alloys rose most (regular AIs'
  income +11 %) where their worth held. Only the regular AIs' energy stockpile (+9 % by 2213.01,
  then flat) has energy's shape — in the wrong direction for a price, so taken as chance. We are
  ~1 % of the galaxy's income; the totals are mostly the fallen empires'.
- **Online (2026-10-23):** nobody describes the AI's deal valuation or a drift — forum threads
  and guides cover the market and trade value only. One forum answer: a deal is broken and ends
  when a side cannot pay its end at the end of a month, and the other side gets an opinion
  penalty. A patch note says the AI recalculates its trade value yearly; that is the economy's
  trade value, and food rose within one year.

### A unit's worth

At once, as the empire gives it (what it gets ÷ its willingness; a month's unit ÷ 60), in the
tooltip's unit, with the empire's gross income of it a month:

| Resource       | KhellZen     | Lolehndra    | Syvaal         | p      | base |
| -------------- | ------------ | ------------ | -------------- | ------ | ---- |
| energy         | 0.0412 (182) | 0.0483 (118) | 0.0039 (4,571) | 0.0747 | 280  |
| minerals       | 0.0483 (100) | 0.0505 (84)  | 0.0061 (2,679) | 0.0733 | 240  |
| food           | 0.0667 (118) | 0.0697 (105) | 0.0056 (3,113) | 0.1485 | 130  |
| trade          | 0.046 (173)  | 0.074 (37)   | 0.0127 (1,101) | 0.0884 | 185  |
| consumer goods | 0.0909 (70)  | 0.0924 (64)  | 0.0176 (1,190) | 0.1253 | 195  |
| alloys         | 0.1304 (21)  | 0.1300 (22)  | 0.0333 (561)   | 0.1468 | 165  |
| living metal   | 0.316 (0)    | 0.317 (0)    | 0.26 (22)      | 0.3144 | 105  |

Worth = p × base / (base + gross income), per resource: every tooltip line and every gift within
3 %, but the 2212.08 mineral deals 7 % and food 12 % (above). Ikaanan's, Cydran's and Dekron's
tooltips (2213.02) are in the fit too. Energy's base rests on 16 empires (the gifts put it
at 280 with an exponent of 0.98 — so the plain form), minerals' on 16 (240); the others' two
numbers on three points each, a best fit until gifts test them. Other forms, fitted the same way (least squares on the log): one base for all (200)
6 % rms, the gifts then 3–17 % high; P × (1 + 50/(50 + net)) — the defines' income base on net
income — fits the two regular empires to 1–2 % but puts the fallen one 8× too high (66 % rms). Not
`ai_weight` (energy 1.5, minerals 1, living metal 100), not market prices, not the stockpile
(KhellZen's 13,063 energy and Lolehndra's 869 differ only by income). `WORTH` in `#lib/aiTrade.ts`
holds it, the test every line above. Not measured: volatile motes, exotic gases, rare crystals,
zro, dark matter and the rest (the nomad test game).

## Measuring more

What worked: in the trade screen, set up the deal and hover the acceptance — "Our Offer Total" and
"Their Offer Total" per resource are the worth — and cancel; nothing is sent, so neither the
opinion cap nor our stockpile limits it. 1000 at once is the cleanest amount (monthly amounts
under ~20 lose a few % to rounding). A screenshot per deal and a manual save at the same date;
read the empire's gross income from that save. Every new number becomes a case in
`aiTrade.test.ts` with its date, so a later change has to reproduce it.
