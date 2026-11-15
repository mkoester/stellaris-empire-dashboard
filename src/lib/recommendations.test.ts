import { describe, expect, it } from 'vitest';
import { ranked, worthwhile, type Recommendation } from './recommendations.ts';

const row = (
	label: string,
	net: number | null,
	stability: number | null = null
): Recommendation => ({
	kind: 'edict',
	label,
	target: null,
	planetId: null,
	possible: true,
	what: { monthly: {}, upkeep: {}, stability, modelled: [], unmodelled: [], net }
});

describe('recommendations', () => {
	it('shows positive trade or stability estimates, ranked by trade value', () => {
		expect(
			worthwhile([
				row('small trade', 0.2),
				row('stability', -3, 1),
				row('loss', -2),
				row('zero', 0)
			])
		).toEqual([row('small trade', 0.2), row('stability', -3, 1)]);
	});

	it('ranks every option for the user-judged view, with unpriced options after priced ones', () => {
		expect(ranked([row('unpriced', null, 2), row('low', 1), row('high', 3)])).toEqual([
			row('high', 3),
			row('low', 1),
			row('unpriced', null, 2)
		]);
	});
});
