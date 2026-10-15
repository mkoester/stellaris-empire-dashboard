import { describe, expect, it } from 'vitest';
import { techTiers } from './techTiers.ts';

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
