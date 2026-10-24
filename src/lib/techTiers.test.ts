import { describe, expect, it } from 'vitest';
import { inReach, techTiers } from './techTiers.ts';

describe('techTiers', () => {
	const tech = (area: string, tier: number) => ({ name: '', cost: 1, area, tier });
	const techs = {
		...Object.fromEntries([...Array(7)].map((_, i) => [`p1_${i}`, tech('physics', 1)])),
		p2_0: tech('physics', 2),
		s1_0: tech('society', 1),
		s2_0: tech('society', 2)
	};

	it('counts per field and tier and opens a tier at 6 of the one below', () => {
		const t = techTiers(['p1_0', 'p1_1', 'p1_2', 'p1_3', 'p1_4', 'p1_5', 's1_0'], techs);
		expect(t.physics[1]).toEqual({ done: 6, total: 7, open: true, needs: 0 });
		expect(t.physics[2]).toEqual({ done: 0, total: 1, open: true, needs: 0 });
		expect(t.society[2]).toEqual({ done: 0, total: 1, open: false, needs: 5 });
		expect(t.engineering[1].open).toBe(true);
	});
});

describe('inReach', () => {
	const tech = (area: string, tier: number) => ({ name: '', cost: 1, area, tier });
	const techs = {
		...Object.fromEntries([...Array(6)].map((_, i) => [`p1_${i}`, tech('physics', 1)])),
		p2_open: tech('physics', 2),
		p2_needs: tech('physics', 2),
		s2_closed: tech('society', 2),
		p1_gestalt: tech('physics', 1),
		p1_unknown: tech('physics', 1)
	};
	const none = { prerequisites: [], potential: null, rare: false, dangerous: false };
	const req = {
		...Object.fromEntries(Object.keys(techs).map((k) => [k, none])),
		p2_needs: { ...none, prerequisites: ['p1_5'] },
		p1_gestalt: { ...none, potential: { leaf: 'is_gestalt', value: 'yes' } },
		p1_unknown: { ...none, potential: { leaf: 'num_rivals', value: '1' } }
	} as Parameters<typeof inReach>[2];
	const possible = (p: unknown) =>
		p === null ? true : (p as { leaf: string }).leaf === 'is_gestalt' ? false : null;

	it('lists techs whose prerequisites are researched and whose tier is open in their field', () => {
		const done = ['p1_0', 'p1_1', 'p1_2', 'p1_3', 'p1_4', 'p1_5'];
		expect(inReach(done, techs, req, possible)).toEqual(['p1_unknown', 'p2_needs', 'p2_open']);
		// p1_5 missing: tier 2 closed (5 of 6), p2_needs also lacks its prerequisite
		expect(inReach(done.slice(0, 5), techs, req, possible)).toEqual(['p1_5', 'p1_unknown']);
	});
});
