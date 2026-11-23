import { ownOnMap, type OwnOnMap } from '#lib/mapLayers.ts';
import type { Arkship } from '#lib/types.ts';
import { getDb } from './app.ts';
import { latestSave } from './db.ts';
import { campaignGalaxy } from './mapSystems.ts';

export type OwnMap = { own: OwnOnMap; arkships: Arkship[] };
let memo: { tip: number; map: OwnMap | null } | null = null;

/**
 * Our own on every map, at `tip`: stations, ships, colonies' systems and a nomad's arkships, from
 * the branch's latest save (GalaxyMap reads it from the layout's data). Kept per tip: the layout
 * asks on every page.
 */
export function ownMapAt(tip: number | null): OwnMap | null {
	if (tip === null) return null;
	if (memo?.tip === tip) return memo.map;
	const s = latestSave(getDb(), tip);
	const map = s
		? {
				own: ownOnMap(s, campaignGalaxy(s.campaign)?.systems ?? null),
				arkships: s.arkships ?? []
			}
		: null;
	memo = { tip, map };
	return map;
}
