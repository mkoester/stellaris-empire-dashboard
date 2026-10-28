import { error } from '@sveltejs/kit';
import { colonyEthics, embrace, ethicRows, ethicSeries, factionSeries } from '#lib/ethicsTab.ts';
import { factionRows, facts } from '#lib/government.ts';
import { xExtent } from '#lib/series.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { display } from '#lib/server/settings.ts';

// Our pops' ethics and what pulls them, and our factions: support, approval, demands, embracing.
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
	const { factionTypes, allFactionTypes } = display();
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
	return {
		...rest,
		seenAt: reading?.date ?? null,
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
		factions: factionRows(data.factionTypes, facts(s, data.scriptedTriggers))
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
		explain: pick(
			getExplanations(),
			order.map((k) => `ethic:${k}`)
		)
	};
}
