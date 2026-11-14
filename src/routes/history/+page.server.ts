import { error } from '@sveltejs/kit';
import { knownHistory, months } from '#lib/history.ts';
import { CATEGORICAL } from '#lib/migration.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, mapSystems } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';

// The galaxy's known history since 2200 along the branch (#lib/history.ts): who held which
// system when, and the events, as far as the branch's latest save lets us know them; the
// `historyAll` cheat shows everything.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const saves = snaps.filter((s) => s.kind === 'save' && s.history);
	const latest = saves.at(-1);
	const history = knownHistory(
		saves.map((s) => ({
			date: s.date,
			history: s.history!,
			communications: (s.relations ?? []).filter((r) => r.communications).map((r) => r.countryId),
			visited: (s.knownSystems ?? []).map((k) => k.id),
			wars: s.allWars ?? [],
			names: [
				...(s.countryId === null ? [] : [[s.countryId, s.empireName] as [number, string]]),
				...(s.relations ?? []).map((r) => [r.countryId, r.name] as [number, string])
			]
		})),
		latest?.countryId ?? -1,
		display().historyAll
	);
	// the map: what the other maps show, plus every system the history names, faint
	const base = mapSystems(snaps);
	const ids = new Set(base.map((s) => s.id));
	const named = new Set(history.changes.map((c) => c.systemId));
	const galaxy = latest ? campaignGalaxy(latest.campaign) : null;
	const extra = (galaxy?.systems ?? [])
		.filter((s) => !ids.has(s.id) && named.has(s.id))
		.map((s) => ({
			id: s.id,
			name: s.name,
			x: s.x,
			y: s.y,
			star: s.star,
			lanes: [],
			known: false
		}));
	// each empire's map colour, else one of ours
	const colors: Record<number, string> = {};
	Object.entries(history.names).forEach(([id, name], i) => {
		colors[Number(id)] = rest.empireColors[name] ?? CATEGORICAL[i % CATEGORICAL.length];
	});
	return {
		...rest,
		history,
		months: latest ? months(latest.date) : [],
		systems: [...base, ...extra],
		colors,
		all: display().historyAll
	};
}
