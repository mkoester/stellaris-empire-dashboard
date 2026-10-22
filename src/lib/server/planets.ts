import { blockerHints, type BlockerHint } from '#lib/blockers.ts';
import { districtCaps, type PlanetDetailsData } from '#lib/districtCaps.ts';
import { pretty } from '#lib/format.ts';
import type { Colony, PlanetState, Snapshot } from '#lib/types.ts';
import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';

/**
 * A planet's details for `PlanetDetails.svelte`: district caps, plus the popups and display names
 * its deposits, modifiers, districts and buildings need.
 */
export function planetDetails(
	planet: PlanetState,
	p: { size: number; planetClass: string; buildings: string[]; built: Record<string, number> },
	empire: string[] = []
): PlanetDetailsData {
	const data = getGameData();
	const caps = districtCaps(
		{
			...planet,
			size: p.size,
			habitat: p.planetClass === 'pc_habitat',
			planetClass: p.planetClass,
			buildings: p.buildings
		},
		p.built,
		data.capEffects,
		data.blockers,
		empire
	);
	const keys = [
		...caps.types.map((t) => t.district),
		...p.buildings,
		...planet.deposits.flatMap((d) => [d.key, ...(d.swap ? [d.swap] : [])])
	];
	return {
		planet,
		caps,
		blockers: data.blockers.filter((b) => planet.deposits.some((d) => d.key === b)),
		names: pick(data.names, keys),
		colors: pick(data.districtColors, keys),
		explain: pick(getExplanations(), [
			...planet.deposits.flatMap((d) => [
				`deposit:${d.key}`,
				...(d.swap ? [`deposit:${d.swap}`] : [])
			]),
			...planet.modifiers.map((m) => `modifier:${m.key}`)
		])
	};
}

const buildingsOf = (c: Colony) =>
	c.districtList.flatMap((d) => d.zones.flatMap((z) => z.buildings));

/** What of the empire can raise its planets' district limits, as `districtCaps` owners. */
export const empireOwners = (s: Snapshot | null): string[] =>
	s
		? [
				...(s.government ?? []).map((k) => `civic:${k}`),
				...(s.origin ? [`origin:${s.origin}`] : []),
				...[...(s.traditions ?? []), ...(s.ascensionPerks ?? [])].map((k) => `tradition:${k}`)
			]
		: [];

/** A colony's planet details (null before snapshots had the planet); `s` adds the empire's part. */
export function colonyDetails(
	c: Colony | undefined,
	s: Snapshot | null = null
): PlanetDetailsData | null {
	if (!c?.planet) return null;
	return planetDetails(
		c.planet,
		{
			size: c.planetSize,
			planetClass: c.planetClass,
			buildings: buildingsOf(c),
			built: Object.fromEntries(c.districtList.map((d) => [d.type, d.built]))
		},
		empireOwners(s)
	);
}

/**
 * What clearing each blocker on the colonies would give, with display names for blockers,
 * features and techs.
 */
export function colonyBlockerHints(
	colonies: Colony[],
	researched: string[],
	s: Snapshot | null = null
): { hints: BlockerHint[]; names: Record<string, string> } {
	const data = getGameData();
	const hints = blockerHints(
		colonies.flatMap((c) => {
			const d = colonyDetails(c, s);
			if (!d) return [];
			return [
				{
					planetId: c.planetId,
					name: c.name,
					planet: d.planet,
					room: d.caps.limit === null ? null : Math.max(0, d.caps.limit - d.caps.built),
					buildings: buildingsOf(c),
					queued: c.buildQueue.filter((q) => q.kind === 'clear_deposit_blocker').map((q) => q.name)
				}
			];
		}),
		data.blockerInfo,
		data.capEffects,
		researched
	);
	const explain = getExplanations();
	const title = (k: string) => explain[`deposit:${k}`]?.title ?? pretty(k);
	return {
		hints,
		names: Object.fromEntries(
			hints.flatMap((h) => [
				[h.blocker, title(h.blocker)],
				...(h.feature ? [[h.feature, title(h.feature)]] : []),
				...h.missing.map((t) => [t, data.techs[t]?.name ?? pretty(t)])
			])
		)
	};
}
