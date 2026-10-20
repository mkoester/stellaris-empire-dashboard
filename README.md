# stellaris-empire-dashboard

A second-screen dashboard for a running game of [Stellaris](https://www.paradoxinteractive.com/games/stellaris).
It reads the game's autosaves, and optionally the `game.log` lines written by its companion mod
(`mod/`). From these it builds history graphs and the state of your colonies. Reloading an older
save starts a new branch instead of overwriting history.

It runs locally next to the game and needs Node 24 plus a database from
[stellaris-data-extraction](https://github.com/mkoester/stellaris-data-extraction). Setup is
described in [`AGENTS.md`](AGENTS.md#running-it).

## Licence

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you
run a modified version as a public service, you must offer its source code to its users.

> Unofficial fan project, not affiliated with Paradox Interactive. Stellaris and all game data and
> text © Paradox Interactive AB.
