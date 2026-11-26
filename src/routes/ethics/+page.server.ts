import { error } from '@sveltejs/kit';
import {
	applies,
	changeOf,
	countryFactor,
	groupTargets,
	holdings,
	ruleRows,
	unlockOf,
	type SourceKind
} from '#lib/ethicSources.ts';
import {
	byEthic,
	colonyEthics,
	embrace,
	ethicRows,
	ethicSeries,
	factionSeries
} from '#lib/ethicsTab.ts';
import { factionRows, facts } from '#lib/government.ts';
import { xExtent } from '#lib/series.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { display } from '#lib/server/settings.ts';
import { colorOf } from '#lib/colors.ts';
import { diplomacyView } from '#lib/diplomacy.ts';
import { ETHIC_BASES, GESTALT, type EthicBase } from '#lib/ethicsMap.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { mapView } from '#lib/situations.ts';

// Our pops' ethics and what pulls them, and our factions: support, approval, demands, embracing;
// then every source of attraction, which apply to us and which we can change (#lib/ethicSources.ts);
// last, a map of every empire's governing ethics, as far as our intel shows them (#lib/ethicsMap.ts).

// the explanation (popup) prefix of a source's kind; buildings, deposits and relics are named apart
const PREFIX: Partial<Record<SourceKind, string>> = {
	tradition: 'tradition',
	perk: 'perk',
	edict: 'edict',
	agenda: 'agenda',
	policy: 'policy',
	civic: 'civic',
	origin: 'origin',
	designation: 'designation',
	council: 'seat',
	leader: 'ltrait',
	static: 'modifier',
	deposit: 'deposit',
	building: 'building'
};
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const s = snaps.findLast((x) => x.kind === 'save');
	if (!s) error(404, 'no save yet');
	const order = data.ethicOrder;
	const government = s.government ?? [];
	const names = Object.fromEntries(order.map((k) => [k, data.identityNames[k] ?? k]));
	const reading = snaps.findLast((x) => x.ethics !== null);
	const opts = display();
	const { factionTypes, allFactionTypes } = opts;
	const formed = snaps.findLast((x) => x.factions !== null)?.factions ?? [];
	const unity = s.stockpile.unity ?? 0;
	const modifiers = s.countryModifiers ?? [];
	const colonyName = new Map(s.colonies.map((c) => [c.planetId, c.name]));
	const ethicColors = Object.fromEntries(
		order.map((k) => {
			const a = data.ethicAxes[k];
			const pole = a && a.axis !== 'hive' ? `ethic-${a.axis}-${a.pos < 0 ? 0 : 1}` : 'ethic-hive';
			return [names[k], pole];
		})
	);
	const explanations = getExplanations();
	const f = facts(s, data.scriptedTriggers, {
		shipKinds: data.shipKinds,
		electionTypes: data.electionTypes,
		archetypes: data.speciesArchetypes,
		slavery: data.speciesRights.flatMap((k) =>
			k.options.filter((o) => o.isSlavery).map((o) => o.key)
		)
	});
	const held = holdings(s);
	const weights = reading?.ethics ? byEthic(reading.ethics.weight, order) : {};
	const sourceName = (kind: SourceKind, key: string) => {
		const [base, finish] = key.split('#');
		const title = PREFIX[kind] ? explanations[`${PREFIX[kind]}:${base}`]?.title : data.names[base];
		return `${title ?? base}${finish ? ' (after launch)' : ''}`;
	};
	const sources = groupTargets(order, government).map((target) => {
		const rules = ruleRows(data.ethicRules[target] ?? [], f);
		return {
			target,
			name:
				target === 'government'
					? 'Governing ethics'
					: target === 'shift'
						? 'Ethics shift speed'
						: names[target],
			ours: government.some(
				(k) =>
					k.startsWith('ethic_') && k.replace(/^ethic_(fanatic|absolute)_/, 'ethic_') === target
			),
			// the empire-wide factor: the save's, and the product of the rules that apply
			weight: weights[target] ?? null,
			computed: rules.length ? countryFactor(rules) : null,
			rules,
			modifiers: data.attractionSources
				.filter((x) => x.target === target)
				.map((x) => ({
					...x,
					name: sourceName(x.kind, x.key),
					ref: PREFIX[x.kind] ? `${PREFIX[x.kind]}:${x.key.split('#')[0]}` : null,
					applies: applies(x, held),
					change: changeOf(x),
					unlock: unlockOf(x, data, f, (prefix, key) =>
						prefix === 'civic'
							? (data.identityNames[key] ?? key)
							: (explanations[`${prefix}:${key}`]?.title ?? key)
					),
					// a leader trait's: our leaders who have it, and whether they sit on the council
					holders:
						x.kind === 'leader'
							? (s.leaderList ?? [])
									.filter((l) => l.traits.includes(x.key))
									.map((l) => ({ name: l.name, council: l.council || l.ruler }))
							: []
				}))
		};
	});
	// the governing-ethics map: the discovered galaxy, its borders, and each empire's ethics from
	// the diplomacy tab's view (what our intel shows; everything with its cheat switch)
	const mapSnap = snaps.findLast((x) => x.firstContacts !== null);
	const diplo = diplomacyView(snaps, data.flagColors, opts.diplomacyAll);
	const ethicsMap = {
		systems: mapView(
			mapSnap ? (campaignGalaxy(mapSnap.campaign)?.systems ?? []) : [],
			reveal(snaps),
			[]
		),
		territories: territoriesOf(snaps),
		// ours from our own government: the save's country list leaves us out
		empires: (diplo?.nodes ?? []).map((n) =>
			n.us
				? {
						id: n.id,
						name: s.empireName || 'us',
						ethics: government.filter((k) => k.startsWith('ethic_')),
						asOf: s.date,
						stale: false
					}
				: {
						id: n.id,
						name: n.name,
						ethics: n.government?.value.ethics ?? null,
						asOf: n.government?.asOf ?? null,
						stale: n.government?.stale ?? false
					}
		),
		read: diplo !== null,
		colors: Object.fromEntries(
			ETHIC_BASES.map((b) => {
				const a = data.ethicAxes[`ethic_${b}`];
				const pole = a && a.axis !== 'hive' ? `ethic-${a.axis}-${a.pos < 0 ? 0 : 1}` : 'ethic-hive';
				// gestalt's own slate grey is near the unknown grey at the map's faint fill: lemon instead
				return [b, b === 'gestalt_consciousness' ? GESTALT : (colorOf(pole) ?? GESTALT)];
			})
		) as Record<EthicBase, string>
	};
	return {
		...rest,
		seenAt: reading?.date ?? null,
		ethicsMap,
		sources,
		// a gestalt consciousness never has factions (its pops "will not join Factions")
		gestalt: government.some((k) => k === 'auth_machine_intelligence' || k === 'auth_hive_mind'),
		axes: data.ethicAxes,
		names,
		rows: reading?.ethics ? ethicRows(reading.ethics, order, government) : [],
		colonies: reading?.ethics
			? colonyEthics(reading.ethics, order).map((c) => ({
					...c,
					name: colonyName.get(c.planetId) ?? `planet ${c.planetId}`
				}))
			: [],
		xExtent: xExtent(snaps),
		ethicColors,
		charts: {
			pops: ethicSeries(snaps, order, 'pops', names),
			attraction: ethicSeries(snaps, order, 'attraction', names),
			support: factionSeries(snaps, 'support'),
			approval: factionSeries(snaps, 'approval')
		},
		// formed factions as the game lists them; the types not formed only with the switches
		factions: factionRows(data.factionTypes, f)
			.map((t) => {
				const f = formed.find((x) => x.type === t.key);
				return {
					...t,
					formed: f,
					embrace: f ? embrace(f, t.ethic, government, unity, modifiers) : null
				};
			})
			.filter((t) => t.formed || allFactionTypes || (factionTypes && t.ours))
			.sort((a, b) => (b.formed?.support ?? -1) - (a.formed?.support ?? -1)),
		anyFormed: formed.length > 0,
		factionTypes: factionTypes || allFactionTypes,
		unity,
		explain: pick(explanations, [
			...order.map((k) => `ethic:${k}`),
			// the sources the panel shows by default: those that apply or can be changed
			...sources.flatMap((g) =>
				g.modifiers.flatMap((m) =>
					m.applies !== false || m.change.how !== 'no'
						? [
								...(m.ref ? [m.ref] : []),
								...m.unlock.needs.flatMap((n) => [
									...(n.ref ? [n.ref] : []),
									...[...(n.authority?.require ?? []), ...(n.authority?.forbid ?? [])].map(
										(k) => `authority:${k}`
									)
								])
							]
						: []
				)
			)
		])
	};
}
