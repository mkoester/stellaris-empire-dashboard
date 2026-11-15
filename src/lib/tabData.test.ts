import { describe, expect, it } from 'vitest';
import { emptyTabs, megastructuresEmpty } from './tabData.ts';
import type { Snapshot } from './types.ts';

// a snapshot read by a current reader with nothing in it
const blank = (over: Partial<Snapshot> = {}) =>
	({
		migration: [],
		tradeDeals: [],
		contracts: [],
		countryId: 0,
		galcom: null,
		shroud: null,
		relations: [],
		subjects: [],
		external: [],
		branchSites: null,
		situations: [],
		firstContacts: [],
		anomalies: [],
		specialProjects: [],
		digSites: [],
		traditions: [],
		slaveMarket: [],
		...over
	}) as Snapshot;

describe('emptyTabs', () => {
	it('dims every tab without data', () => {
		expect(Object.keys(emptyTabs([blank()])).sort()).toEqual([
			'contracts',
			'diplomacy',
			'frontier',
			'galcom',
			'migration',
			'pacts',
			'shroud',
			'slave market',
			'subjects',
			'trade deals',
			'traditions'
		]);
	});

	it('a tab with data in any snapshot of the branch is not dimmed', () => {
		const moved = blank({
			migration: [{ own: true, immigration: 2, emigration: 0 }] as Snapshot['migration']
		});
		expect(emptyTabs([moved, blank()]).migration).toBeUndefined();
	});

	it('a pact undims the pacts tab, an embassy does not', () => {
		const rel = (agreements: string[]) =>
			blank({ relations: [{ contact: true, agreements }] as unknown as Snapshot['relations'] });
		expect(emptyTabs([rel(['embassy'])]).pacts).toBeDefined();
		expect(emptyTabs([rel(['research_agreement'])]).pacts).toBeUndefined();
	});

	it('the Shroud counts once a patron is met, not for the attunement every empire has', () => {
		const shroud = (contact: string) =>
			blank({
				shroud: {
					attunement: { x: 0, y: 0 },
					monthStart: { x: 0, y: 0 },
					lastDelve: '0.01.01',
					preferred: null,
					patrons: [{ contact }]
				} as unknown as Snapshot['shroud']
			});
		expect(emptyTabs([shroud('none')]).shroud).toBeDefined();
		expect(emptyTabs([shroud('completed')]).shroud).toBeUndefined();
	});

	it('an adopted tree undims the traditions tab', () => {
		expect(emptyTabs([blank({ traditions: ['tr_expansion_adopt'] })]).traditions).toBeUndefined();
	});

	it('foreign migration alone does not count', () => {
		const foreign = blank({
			migration: [{ own: false, immigration: 5, emigration: 5 }] as Snapshot['migration']
		});
		expect(emptyTabs([foreign]).migration).toBeDefined();
	});

	it('a field no snapshot knows (older reader) is unknown, never dimmed', () => {
		expect(emptyTabs([blank({ migration: null, relations: null })])).not.toHaveProperty(
			'migration'
		);
		expect(emptyTabs([blank({ relations: null })])).not.toHaveProperty('diplomacy');
		expect(emptyTabs([])).toEqual({});
	});
});

describe('megastructuresEmpty', () => {
	const research = (researched: string[]) => ({
		progress: { researched } as Snapshot['progress']
	});
	const sys = (megastructures: string[], visited = true) => ({ visited, megastructures });

	it('is empty until a structure is found or its tech researched', () => {
		expect(megastructuresEmpty([research(['tech_lasers_1'])], [sys([])])).toMatch(
			/no megastructure/
		);
		expect(megastructuresEmpty([research([]), research(['tech_dyson_swarm'])], [])).toBeNull();
		expect(megastructuresEmpty([research([])], [sys(['ruined_dyson_sphere'])])).toBeNull();
	});

	it('does not count gateways, nor what lies in a system not visited', () => {
		expect(
			megastructuresEmpty([research([])], [sys(['gateway_ruined']), sys(['ring_world_1'], false)])
		).not.toBeNull();
	});

	it('is not empty while nothing is known', () => {
		expect(megastructuresEmpty([{ progress: null }], null)).toBeNull();
	});
});
