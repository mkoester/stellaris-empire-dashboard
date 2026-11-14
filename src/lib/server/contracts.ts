// The contracts the player may see at a branch, for the contracts tab and every map's layer.
import {
	contractMarks,
	contractRows,
	type ContractMark,
	type ContractRow
} from '#lib/contracts.ts';
import { nomadic } from '#lib/planner/kinds.ts';
import type { Display } from '#lib/profiles.ts';
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import type { Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { contractView } from './settings.ts';

export type ContractsAt = {
	rows: ContractRow[];
	known: boolean; // a save of the branch was read with contracts (READER 52)
	nomadic: boolean;
	date: string | null; // of that save
	systemNames: Record<number, string>;
	range: string;
};

/** `shown` is the request's `display()` — read once per request, never here. */
export function contractsAt(snaps: Snapshot[], shown: Display): ContractsAt {
	const s = snaps.findLast((x) => x.contracts !== null);
	const range = contractView().range;
	if (!s?.contracts || s.countryId === null)
		return { rows: [], known: false, nomadic: false, date: null, systemNames: {}, range };
	const systems = campaignGalaxy(s.campaign)?.systems ?? [];
	const isNomad = nomadic(s);
	const rows = contractRows(s.contracts, {
		me: s.countryId,
		nomadic: isNomad,
		talking: new Set((s.relations ?? []).filter((r) => r.communications).map((r) => r.countryId)),
		// along the lanes we know, as the systems and megastructures tabs count beyond the border
		jumps: jumpsFromBorder(
			discovered(systems, { whole: shown.wholeGalaxy, stars: shown.unknownStars })
		),
		range,
		spoilers: shown.contractSpoilers,
		all: shown.contractsAll,
		types: getGameData().contractTypes
	});
	const used = new Set(rows.map((r) => r.systemId));
	return {
		rows,
		known: true,
		nomadic: isNomad,
		date: s.date,
		systemNames: Object.fromEntries(
			systems.filter((x) => used.has(x.id)).map((x) => [x.id, x.name])
		),
		range
	};
}

/** The contracts layer of the other maps (`ContractMarks.svelte`). */
export function contractMarksAt(snaps: Snapshot[], shown: Display): ContractMark[] {
	const c = contractsAt(snaps, shown);
	return contractMarks(c.rows, c.systemNames);
}
