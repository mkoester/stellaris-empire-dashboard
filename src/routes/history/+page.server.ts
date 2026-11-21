import { error } from '@sveltejs/kit';
import { splinterOf } from '#lib/contacts.ts';
import { knownHistory, months, type HistoryMode } from '#lib/history.ts';
import { CATEGORICAL } from '#lib/migration.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, mapSystems } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';

// The galaxy's known history since 2200 along the branch (#lib/history.ts): who held which
// system when, and the events, as far as the branch's latest save lets us know them; the
// `historyMet` spoiler shows everything about the empires we met, the `historyAll` cheat everything.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const saves = snaps.filter((s) => s.kind === 'save' && s.history);
	const { historyAll, historyMet } = display();
	const mode: HistoryMode = historyAll ? 'all' : historyMet ? 'met' : 'known';
	const latest = saves.at(-1);
	// a fallen hive's fragments carry their splinter in every name the tab shows (map, events),
	// by id — once we talk to them, as everywhere (`empireTags`); the plain name finds the colour
	const talking = new Set(
		(latest?.relations ?? []).filter((r) => r.communications).map((r) => r.countryId)
	);
	const splinters = new Map(
		(latest?.countries ?? []).flatMap((c) => {
			const t = talking.has(c.id) ? splinterOf(c.governmentType) : null;
			return t ? [[c.id, t] as [number, string]] : [];
		})
	);
	const plain = new Map<number, string>();
	const tagged = ([id, n]: [number, string]): [number, string] => {
		plain.set(id, n);
		const t = splinters.get(id);
		return [id, t ? `${n} (${t})` : n];
	};
	const history = knownHistory(
		saves.map((s) => ({
			date: s.date,
			history: { ...s.history!, names: s.history!.names.map(tagged) },
			communications: (s.relations ?? []).filter((r) => r.communications).map((r) => r.countryId),
			met: (s.relations ?? []).map((r) => r.countryId),
			intel: (s.intel ?? []).map((i) => [i.countryId, i.intel] as [number, number]),
			wars: s.allWars ?? [],
			names: [
				...(s.countryId === null ? [] : [[s.countryId, s.empireName] as [number, string]]),
				...(s.relations ?? []).map((r) => [r.countryId, r.name] as [number, string])
			].map(tagged)
		})),
		latest?.countryId ?? -1,
		mode
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
		colors[Number(id)] =
			rest.empireColors[plain.get(Number(id)) ?? name] ?? CATEGORICAL[i % CATEGORICAL.length];
	});
	return {
		...rest,
		history,
		months: latest ? months(latest.date) : [],
		systems: [...base, ...extra],
		colors,
		mode
	};
}
