import { describe, expect, it } from 'vitest';
import { emptyTabs } from './tabData.ts';
import type { Snapshot } from './types.ts';

// a snapshot read by a current reader with nothing in it
const blank = (over: Partial<Snapshot> = {}) =>
	({
		migration: [],
		tradeDeals: [],
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
		...over
	}) as Snapshot;

describe('emptyTabs', () => {
	it('dims every tab without data', () => {
		expect(Object.keys(emptyTabs([blank()])).sort()).toEqual([
			'diplomacy',
			'galcom',
			'migration',
			'pacts',
			'shroud',
			'situations',
			'subjects',
			'trade deals'
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
