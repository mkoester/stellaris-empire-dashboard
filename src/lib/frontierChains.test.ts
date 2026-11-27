import { describe, expect, it } from 'vitest';
import { lgateView, precursorGalaxy, precursorPlaces, precursorRows } from './frontierChains.ts';
import type { GalaxySystem } from './types.ts';

const types = {
	l_cluster_chain: {
		title: 'The L-Cluster',
		category: 'developments',
		counters: [{ key: 'clues', max: 7 }]
	},
	cybrex_chain: {
		title: 'Precursors - The Cybrex',
		category: 'precursors',
		counters: [{ key: 'cybrex_artifacts', max: 6 }]
	},
	cybrex_homeworld_chain: { title: 'The Cybrex Home System', category: 'precursors', counters: [] },
	yuht_chain: {
		title: 'Precursors - The Yuht',
		category: 'precursors',
		counters: [{ key: 'yuht_artifacts', max: 6 }]
	},
	cs_inetian_chain: {
		title: 'Precursors - The Inetian Traders',
		category: 'precursors',
		counters: []
	}
};
const sys = (id: number, visited: boolean, bypasses: string[]) =>
	({ id, visited, owned: false, bypasses }) as unknown as GalaxySystem;

describe('lgateView', () => {
	// Roaming Cybergang 2226.08.01: the first L-Gate found, no insight yet, the tech on offer
	it('counts insights, gates we know and what is on offer', () => {
		const v = lgateView({
			chains: { active: [{ key: 'l_cluster_chain', counters: {} }], completed: [] },
			types,
			flags: ['encountered_first_lgate'],
			researched: [],
			options: { engineering: ['tech_repeatable_lcluster_clue', 'tech_thrusters_2'] },
			galaxy: [sys(1, true, ['lgate']), sys(2, false, ['lgate']), sys(3, true, ['gateway'])]
		});
		expect(v).toEqual({
			encountered: true,
			insights: 0,
			needed: 7,
			complete: false,
			activated: false,
			gates: 1,
			insightTech: true,
			activationTech: false
		});
	});

	it('reads all insights once the chain is complete', () => {
		const v = lgateView({
			chains: { active: [], completed: ['l_cluster_chain'] },
			types,
			flags: ['encountered_first_lgate', 'completed_lcluster_chain'],
			researched: ['tech_lgate_activation'],
			options: null,
			galaxy: []
		});
		expect([v.insights, v.complete, v.activated]).toEqual([7, true, true]);
	});
});

describe('precursorRows', () => {
	it('lists the chains we started, artifacts and home system', () => {
		const rows = precursorRows(
			{
				active: [
					{ key: 'yuht_chain', counters: { yuht_artifacts: 4 } },
					{ key: 'cybrex_homeworld_chain', counters: {} },
					{ key: 'cs_inetian_chain', counters: {} }
				],
				completed: ['cybrex_chain']
			},
			types
		);
		expect(rows.map((r) => [r.name, r.artifacts, r.needed, r.done, r.homeworld])).toEqual([
			['The Cybrex', 6, 6, true, 'found'],
			['The Yuht', 4, 6, false, 'none'],
			['The Inetian Traders', null, null, false, 'none']
		]);
		expect(precursorRows({ active: [], completed: [] }, types)).toEqual([]);
		expect(precursorRows(null, types)).toEqual([]);
	});
});

describe('precursorGalaxy', () => {
	it('every precursor: in this galaxy or not, its systems, who collects it', () => {
		const rows = precursorGalaxy(
			{
				disabled: ['precursor_1', 'precursor_2', 'precursor_3', 'precursor_4', 'precursor_baol_1'],
				systems: { precursor_5: [12, 13, 14] },
				chains: [
					{
						countryId: 7,
						country: 'Barcalid Collective',
						key: 'cybrex_chain',
						counters: { cybrex_artifacts: 2 },
						done: false
					},
					{
						countryId: 0,
						country: 'Roaming Cybergang',
						key: 'cybrex_chain',
						counters: {},
						done: true
					},
					{
						countryId: 0,
						country: 'Roaming Cybergang',
						key: 'cybrex_homeworld_chain',
						counters: {},
						done: false
					}
				]
			},
			types,
			(id) => id === 12,
			0
		);
		const cybrex = rows.find((r) => r.flag === 'precursor_5')!;
		expect([cybrex.name, cybrex.enabled, cybrex.visited, cybrex.systems]).toEqual([
			'The Cybrex',
			true,
			1,
			3
		]);
		expect(cybrex.empires).toEqual([
			{
				country: 'Barcalid Collective',
				us: false,
				artifacts: 2,
				needed: 6,
				done: false,
				homeworld: 'none'
			},
			{
				country: 'Roaming Cybergang',
				us: true,
				artifacts: 6,
				needed: 6,
				done: true,
				homeworld: 'found'
			}
		]);
		const vultaum = rows.find((r) => r.flag === 'precursor_1')!;
		expect([vultaum.enabled, vultaum.systems, vultaum.empires]).toEqual([false, 0, []]);
		// the storm precursors have no star flag of their own
		expect(rows.find((r) => r.flag === 'precursor_inetian')?.systems).toBeNull();
		expect(rows.length).toBe(9);
	});
});

describe('precursorPlaces', () => {
	it('every flagged system and precursor dig site, by system', () => {
		const places = precursorPlaces(
			{ disabled: [], systems: { precursor_5: [12, 13] }, chains: [] },
			[
				{ systemId: 13, type: 'zroni_digsite_1' },
				{ systemId: 20, type: 'site_debris_belt' },
				{ systemId: null, type: 'baol_digsite_1' }
			],
			(t) => (t.startsWith('zroni') ? ['Zroni'] : t.startsWith('baol') ? ['Baol'] : [])
		);
		expect(places).toEqual([
			{ systemId: 12, names: ['The Cybrex'] },
			{ systemId: 13, names: ['The Cybrex', 'The Zroni (dig site)'] }
		]);
	});
});
