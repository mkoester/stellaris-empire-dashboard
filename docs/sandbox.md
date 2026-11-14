# Sandbox notes: the rest

Slow end-to-end checks while the game runs, and the Mac notes. The rules for every session are in `AGENTS.md`, "Sandbox notes". _Moved verbatim from `AGENTS.md` on 2026-11-14._

**While the game runs, an end-to-end check is slow**: a dev server on a DB copy backfills every
save new since the copy first (minutes with a few dozen; every save on disk after a `READER` bump
in the played campaign), and tests take 2–3× as long — run it in the background and
wait for its output; pick nodes by date from the copy's `node` table.

- **The pinned Node is not first on PATH** (MacPorts' `node` is 22, pulled in by the `pnpm` port). Prefix
  commands with `fnm exec --using=26 --`.
- Starting the dev server needs `sandbox.network.allowLocalBinding` (set in the workspace
  `.claude/settings.json`); start it and make the requests in one Bash command.
