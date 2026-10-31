import type { CountryInfo, Explanation, GalaxySystem, GameData } from '#lib/types.ts';

// What an outpost or a waystation in a system would bring, for the planner's popups: the station
// deposits (and for a waystation the module that collects each — 4.5.3
// starbase_modules/00_waystation_modules.txt, `collected_system_resources`), the planets, a pre-FTL
// civilisation to observe, anomalies, megastructures and wormholes. Only what the galaxy as shown
// holds (`surveyView`): an unvisited system's contents are unknown. Pure.

/** The waystation module that collects each resource. */
const MODULE: Record<string, string> = {
	energy: 'energy module',
	minerals: 'mining module',
	food: 'mining module',
	consumer_goods: 'mining module',
	alloys: 'mining module',
	volatile_motes: 'refinery module',
	exotic_gases: 'refinery module',
	rare_crystals: 'refinery module'
};
const moduleOf = (resource: string) => MODULE[resource] ?? 'research module';

type Data = Pick<GameData, 'costs' | 'depositCategories' | 'planetClasses' | 'resourceInfo'>;

export function systemInfo(
	s: GalaxySystem | undefined,
	kind: 'outpost' | 'waystation',
	data: Data,
	countries: CountryInfo[],
	spoil = false // the surveyAll spoiler: deposits of unsurveyed bodies too
): Explanation {
	const title = `${kind === 'outpost' ? 'Outpost' : 'Waystation'} in ${s?.name ?? 'an unknown system'}`;
	if (!s?.bodies)
		return {
			title,
			description: 'Not visited yet: what it holds is unknown.',
			modifiers: [],
			text: null,
			facts: []
		};
	const resName = (r: string) => data.resourceInfo[r]?.name ?? r.replace(/_/g, ' ');
	const facts: string[] = [];
	// station deposits: what a starbase (or a waystation's modules) collects
	// the game shows a body's deposits once surveyed
	const station = s.bodies.flatMap((b) =>
		(spoil || b.surveyed !== false ? b.deposits : [])
			.filter((d) => /^orbital_/.test(data.depositCategories[d] ?? ''))
			.flatMap((d) =>
				Object.entries(data.costs.deposit[d]?.produces ?? {}).map(([r, v]) => ({
					r,
					v,
					at: b.name
				}))
			)
	);
	if (station.length) {
		const byRes = new Map<string, { v: number; at: string[] }>();
		for (const x of station) {
			const e = byRes.get(x.r) ?? { v: 0, at: [] };
			e.v += x.v;
			e.at.push(x.at);
			byRes.set(x.r, e);
		}
		for (const [r, e] of byRes)
			facts.push(
				`${resName(r)} +${Math.round(e.v * 100) / 100}/month${kind === 'waystation' ? ` (${moduleOf(r)})` : ''} — ${e.at.join(', ')}`
			);
	} else facts.push('No station deposits.');
	const primitive = s.bodies.filter((b) => {
		const owner = countries.find((c) => c.id === b.ownerId);
		return owner?.type === 'primitive';
	});
	for (const b of primitive) {
		const who = countries.find((c) => c.id === b.ownerId)?.name ?? 'a pre-FTL civilisation';
		facts.push(
			kind === 'outpost'
				? `Pre-FTL civilisation on ${b.name} (${who}): an observation post can study it`
				: `Pre-FTL civilisation on ${b.name} (${who}): a research module can study it`
		);
	}
	const planets = s.bodies.filter((b) => !b.star);
	const colonizable = planets.filter(
		(b) => data.planetClasses[b.class]?.colonizable && !b.colonized && b.ownerId === null
	);
	facts.push(
		`${planets.length} bodies${colonizable.length ? `; colonizable: ${colonizable.map((b) => `${b.name} (${data.planetClasses[b.class]?.name ?? b.class} ${b.size})`).join(', ')}` : ''}`
	);
	const unsurveyed = planets.filter((b) => !b.surveyed).length;
	if (unsurveyed) facts.push(`${unsurveyed} not surveyed yet: more may be there`);
	const anomalies = s.bodies.filter((b) => b.anomaly);
	if (anomalies.length) facts.push(`Anomalies: ${anomalies.map((b) => b.name).join(', ')}`);
	if (s.megastructures.length)
		facts.push(`Structures: ${s.megastructures.map((m) => m.replace(/_/g, ' ')).join(', ')}`);
	if (s.bypasses?.length)
		facts.push(`Passages: ${s.bypasses.map((m) => m.replace(/_/g, ' ')).join(', ')}`);
	return {
		title,
		description:
			kind === 'outpost'
				? 'Claims the system: its station deposits can be mined or researched, its planets settled.'
				: 'Collects the system’s deposits through its modules, one module per kind.',
		modifiers: [],
		text: null,
		facts
	};
}
