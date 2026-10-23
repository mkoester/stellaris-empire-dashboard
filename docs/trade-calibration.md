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

What it settles (in `#lib/aiTrade.ts` with these numbers as its test):

- The acceptance is the sum of the two sides' worth, each linear in the amount (energy: 36 → 89,
  25 → 62); nothing for attitude or opinion beside them.
- Energy and minerals: `ai_weight` × 50 / (50 + net income) — minerals within 2 %, though at 2 % of
  its storage: no extra worth for being short. The tooltip's unit is that × ≈ 4.79 (5 × 0.95?
  a one-off payment would tell).
- It pays at most `TRADE_MAX_RESOURCE_PERCENT` (0.3) of its gross monthly income, rounded down:
  54 of 181.9 energy (55 → −1000). We could give no more living metal than our income (5.25).

Not settled — worth per unit a month in the tooltip's unit against that form: food 3.8 (form 2.1),
consumer goods ≈ 5.0 (15), alloys 7.4 (18), living metal 18 (478); trade ≈ 2.6 (`tradeWeight` 1
gives 2.2). Neither market prices, its own market (no fluctuations), its storage, `ai_wants`, gross
income nor our economy explains them; the AI's `ai_resource_target_records` (energy 10, minerals
25, food 10, trade 10, consumer goods 10, alloys 20) neither. Next: the same rows with a second
empire of a different economy, with tooltips, and one one-off payment against the same amount a
month.

## Afterwards

Send the filled tables and the session's saves folder name. The fitted constants go into the
trade model with these numbers as its test, so a later change has to reproduce them.
