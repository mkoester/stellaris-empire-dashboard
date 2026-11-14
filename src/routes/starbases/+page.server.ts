import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { starbaseView } from '#lib/server/settings.ts';
import { starbasePlan } from '#lib/server/starbasePlanner.ts';

// Our starbases at the branch's latest save, with the slots each has left (#lib/starbases.ts).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.stations !== null) ?? b.latest;
	const stations = latest.stations ?? [];
	const game = getGameData();
	const view = starbaseView();
	return {
		...rest,
		date: latest.date,
		stations,
		megas: latest.megaShipyards ?? [],
		researched: latest.progress?.researched ?? [],
		capacity: latest.starbases,
		slots: game.starbaseSlots,
		// the game's names of the modules and buildings built or queued
		partNames: pick(
			game.names,
			stations.flatMap((s) => [...s.modules, ...s.buildings, ...s.queue.map((q) => q.name)])
		),
		view,
		// where to build which module or building (#lib/starbasePlanner.ts); null without the data
		planner: latest.kind === 'save' ? starbasePlan(latest, view.range) : null
	};
}
