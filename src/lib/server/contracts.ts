// The contracts the player may see at a branch, for the contracts tab and every map's layer.
import {
	contractDetail,
	contractMarks,
	contractRows,
	type ContractDetail,
	type ContractMark,
	type ContractRow
} from '#lib/contracts.ts';
import { graph } from '#lib/galaxyGraph.ts';
import { nomadic } from '#lib/planner/kinds.ts';
import type { Display } from '#lib/profiles.ts';
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import type { Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { setting } from './settings.ts';
import { valuesOf } from './unitCosts.ts';

export type ContractsAt = {
	rows: (ContractRow & { detail: ContractDetail })[];
	known: boolean; // a save of the branch was read with contracts (READER 52)
	nomadic: boolean;
	date: string | null; // of that save
	systemNames: Record<number, string>;
	range: string;
};

/** `shown` is the request's `display()` — read once per request, never here. */
export function contractsAt(snaps: Snapshot[], shown: Display): ContractsAt {
	const s = snaps.findLast((x) => x.contracts !== null);
	const range = setting('contractView').range;
	if (!s?.contracts || s.countryId === null)
		return { rows: [], known: false, nomadic: false, date: null, systemNames: {}, range };
	const systems = campaignGalaxy(s.campaign)?.systems ?? [];
	const known = discovered(systems, { whole: shown.wholeGalaxy, stars: shown.unknownStars });
	const isNomad = nomadic(s);
	const data = getGameData();
	const rows = contractRows(s.contracts, {
		me: s.countryId,
		nomadic: isNomad,
		talking: new Set((s.relations ?? []).filter((r) => r.communications).map((r) => r.countryId)),
		// along the lanes we know, as the systems and megastructures tabs count beyond the border
		jumps: jumpsFromBorder(known),
		range,
		spoilers: shown.contractSpoilers,
		all: shown.contractsAll,
		types: data.contractTypes
	});
	const used = new Set(rows.flatMap((r) => [r.systemId, r.pickup, r.dropoff]));
	const names = Object.fromEntries(
		systems.filter((x) => used.has(x.id)).map((x) => [x.id, x.name])
	);
	// the latest save's: a month from the feed alone carries none of these
	const save = snaps.findLast((x) => x.kind === 'save') ?? s;
	const detailCtx = {
		completed: save.contractsCompleted,
		researched: new Set(save.progress?.researched ?? []),
		arkships: save.arkships ?? [],
		lanes: graph(
			known.flatMap((x) => x.lanes.map((to): [number, number] => [x.id, to])),
			[]
		),
		values: valuesOf(snaps),
		techName: (k: string) => data.techs[k]?.name ?? k
	};
	return {
		rows: rows.map((r) => ({
			...r,
			detail: contractDetail(r, data.contractTypes[r.key], {
				...detailCtx,
				systemName: r.systemId === null ? null : (names[r.systemId] ?? null)
			})
		})),
		known: true,
		nomadic: isNomad,
		date: s.date,
		systemNames: names,
		range
	};
}

/** The contracts layer of the other maps (`ContractMarks.svelte`). */
export function contractMarksAt(snaps: Snapshot[], shown: Display): ContractMark[] {
	const c = contractsAt(snaps, shown);
	return contractMarks(c.rows, c.systemNames);
}
