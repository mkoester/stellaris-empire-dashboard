# Calibrating the AI's view of a trade

The trade tab predicts what an AI empire would accept and what a gift does to its opinion. The
game computes both in the engine; its files only give the inputs (4.5.2): each resource's
`ai_weight` and `ai_wants`, the AI's stockpile and income, `TRADE_VALUE_RESOURCE_INCOME_BASE` (50),
`TRADE_VALUE_RESOURCE_MONTHLY_MULT` (0.5: monthly payments count half), the storage thresholds
`TRADE_RESOURCE_STOCKPILE_UNDER/OVER` (0.33 / 0.75 of max), the personality's `trade_willingness`
(0 … 1.1) and the attitude, which refuses everything when it does not trade. Gifts:
`opinion_trade_gift` (+1 per point, accumulates to 100, decays 2 a month); how much value buys a
point is not in the files.

This session gives the numbers the model is fitted to. About an hour, on Linux, in a throwaway
game — never the real campaign (cheats end achievements, and its history lives only in the DB).

## Setup

1. New game, small galaxy, 8+ AI empires, **no** `debug_yesmen`. Play until 2200.02.01.
2. Console: `contact`, `communications` (meet everyone), `debugtooltip` (ids in tooltips).
3. Give yourself plenty: `cash 50000`, `minerals 50000`, `resource alloys 20000`,
   `resource consumer_goods 20000`, `resource food 20000`, `resource volatile_motes 500` (AGENTS.md lists the form as `resource <n> <res>` — if the console refuses, swap the order).
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

## 1. Acceptance (≈ 20 offers)

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

## 2. Gifts and opinion

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

## 3. An attitude that does not trade

If any empire shows unfriendly, rival, hostile, domineering or threatened: one offer (row 1's)
to it, its acceptance.

## Results so far

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
acceptance showed a line "Gift: +1" of its own. The decay (−2 a month) shows from the next
autosave on.

### A unit's worth

At once, as the empire gives it (what it gets ÷ its willingness; a month's unit ÷ 60), in the
tooltip's unit, with the empire's gross income of it a month:

| Resource       | KhellZen     | Lolehndra    | Syvaal         | p      | base |
| -------------- | ------------ | ------------ | -------------- | ------ | ---- |
| energy         | 0.0412 (182) | 0.0483 (118) | 0.0039 (4,571) | 0.0676 | 280  |
| minerals       | 0.0483 (100) | 0.0505 (84)  | 0.0061 (2,679) | 0.0664 | 270  |
| food           | 0.0667 (118) | 0.0697 (105) | 0.0056 (3,113) | 0.1153 | 160  |
| trade          | 0.046 (173)  | 0.074 (37)   | 0.0127 (1,101) | 0.0898 | 180  |
| consumer goods | 0.0909 (70)  | 0.0924 (64)  | 0.0176 (1,190) | 0.1224 | 200  |
| alloys         | 0.1304 (21)  | 0.1300 (22)  | 0.0333 (561)   | 0.1487 | 160  |
| living metal   | 0.316 (0)    | 0.317 (0)    | 0.26 (22)      | 0.3167 | 100  |

Worth = p × base / (base + gross income), per resource: every tooltip line and every gift within
2.3 %. Energy's base rests on 16 empires (the gifts put it at 280 with an exponent of 0.98 — so
the plain form); the others' two numbers on three points each, a best fit until the next gifts
test them. Other forms, fitted the same way (least squares on the log): one base for all (200)
6 % rms, the gifts then 3–17 % high; P × (1 + 50/(50 + net)) — the defines' income base on net
income — fits the two regular empires to 1–2 % but puts the fallen one 8× too high (66 % rms). Not
`ai_weight` (energy 1.5, minerals 1, living metal 100), not market prices, not the stockpile
(KhellZen's 13,063 energy and Lolehndra's 869 differ only by income). `WORTH` in `#lib/aiTrade.ts`
holds it, the test every line above. Not measured: volatile motes, exotic gases, rare crystals,
zro, dark matter and the rest (the nomad test game).

## Afterwards

Send the filled tables and the session's saves folder name. The fitted constants go into the
trade model with these numbers as its test, so a later change has to reproduce them.
