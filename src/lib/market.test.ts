import { describe, expect, it } from 'vitest';
import { monthlyLimit } from './market.ts';

describe('monthlyLimit', () => {
	it('matches the limits the game UI shows (RustyMonthlyLimits, 4.5.2)', () => {
		const both = (resource: string) => [
			monthlyLimit({ kind: 'buy', resource }),
			monthlyLimit({ kind: 'sell', resource })
		];
		expect(both('energy')).toEqual([42, 64]);
		expect(both('consumer_goods')).toEqual([21, 32]);
		expect(both('alloys')).toEqual([10, 16]);
		expect(both('exotic_gases')).toEqual([4, 6]);
		expect(both('sr_dark_matter')).toEqual([2, 3]);
	});

	it('has none for resources the market does not trade', () => {
		expect(monthlyLimit({ kind: 'buy', resource: 'unity' })).toBeNull();
	});
});
