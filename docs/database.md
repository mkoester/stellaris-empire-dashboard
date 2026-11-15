# Dashboard DB: start-up, cleaning up, migrations so far

Detail behind the DB rules in `AGENTS.md`. Read before changing `watch.ts`, `campaigns.ts` or adding a migration. _Moved verbatim from `AGENTS.md` on 2026-11-14._

- **A start reads one campaign, the rest follows in the background** (`watch.ts`): before the
  dashboard is up, only the head campaign's saves to read (new, changed, or of an older reader) —
  with an empty DB the campaign of the newest save. The other campaigns wait in a backlog that
  `catchUp` works off 3 s after `running` (`CATCH_UP_DELAY_MS` in `app.ts`), the most recently
  played first, one save per turn of the watcher's lock, so live autosaves and pages get through.
  A backlog read places a save after the campaign's node read last (`record(…, at)`) and **never
  moves the head** — game.log months go to the head's campaign. A campaign viewed meanwhile
  (`refreshCampaign`) or played meanwhile (a new autosave in it) has its backlog read at once,
  first. Pages reload on the `refreshed` event. Checked 2026-10-22 on a copy of this machine's DB:
  the head campaign's 10 saves before the first page, the other campaign's 27 within 34 s.
- **Cleaning up** (`campaigns.ts`, `POST /api/campaigns`): the config tab lists every campaign in
  the history with a delete; a campaign with no saves left on disk (`Watcher.onDisk`, from the last
  scan) gets a banner once — "keep it" goes to the `keptCampaigns` setting, never asked again.
  `deleteCampaign` drops its nodes, snapshots and galaxy but keeps its `save_file` rows, so saves
  still on disk are not read back in (`refresh` leaves a save not in the graph out); a new save of
  that campaign starts it afresh.
- **Migrations so far:** 16 — `node.seq`, each campaign numbering its own nodes (the timeline's
  "#", the user's ask 2026-10-30), the stored ones in the order they were recorded; `id` stays the
  global key of links (`?node=`), parents and snapshots. Checked 2026-10-30 on a copy of this
  machine's DB: five campaigns, ids 1…303 → each 1…n without gaps (Roaming Korinth 287–303 →
  1–17), `dashboard.v15.sqlite` left beside it. Tests building an older DB use the base tables
  alone (`openDb(file, [])`) and insert nodes as 0.1.0 did. The server log names nodes the same
  way (`nodeLabel()`: "new node #17 of roamingkorinth_…"). 17 — `plan_event`, the planner's log
  of changes (`docs/tabs-planner.md`). Checked 2026-10-31 on a copy of this machine's DB (`dashboard.v16.sqlite`
  left beside it). `deleteCampaign` drops a campaign's plan rows before its nodes (foreign key).
  18 — indexes only: `node (campaign, kind, id)` for a campaign's latest save, and an expression
  index on a snapshot's `galaxySetup.ironman`. Before them the layout spent ~400 ms of every page
  in `campaignName` and `campaignRows` (CPU profile on a copy of this machine's DB, 2026-11-15,
  330 nodes, 91 MB of snapshots). A query that should start from an expression index says so with
  `+n.campaign`, or the planner takes the campaign's index and parses each snapshot.
