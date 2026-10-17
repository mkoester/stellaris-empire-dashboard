import { describe, expect, it } from 'vitest';
import { basePrice, marketSwitches, monthlyLimit, price, priceSeries } from './market.ts';
import type { Market } from './types.ts';
import { upgrade } from './upgrade.ts';

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

describe('monthlyLimit on the galactic market', () => {
	it('has none', () => {
		expect(monthlyLimit({ kind: 'sell', resource: 'energy' }, true)).toBeNull();
	});
});

describe('price', () => {
	it('is the base price moved by the fluctuation', () => {
		expect(basePrice('energy')).toBe(1);
		expect(basePrice('alloys')).toBe(4);
		expect(basePrice('sr_zro')).toBe(20);
		expect(price('energy', -15.92241)).toBeCloseTo(0.8408, 4);
		expect(price('alloys', 50)).toBe(6);
	});

	it('is null for what the market does not trade', () => {
		expect(price('unity', 0)).toBeNull();
	});
});

const at = (date: string, market: Market | null) =>
	upgrade({ kind: market ? 'save' : 'log', campaign: 'c', date, market });

describe('priceSeries', () => {
	const history = [
		at('2200.01.01', { galactic: false, fluctuations: { energy: 0, alloys: 0 } }),
		at('2200.02.01', null), // mod feed: no prices
		at('2200.03.01', { galactic: false, fluctuations: { energy: -50, alloys: 25, sr_zro: 10 } })
	];

	it('prices each traded resource per save, a gap where it was not traded', () => {
		expect(priceSeries(history, ['energy', 'sr_zro', 'unity'])).toEqual({
			x: [2200, 2200 + 2 / 12],
			lines: { energy: [1, 0.5], sr_zro: [null, 22] }
		});
	});
});

describe('marketSwitches', () => {
	it('dates the move to the galactic market and back', () => {
		const g = (date: string, galactic: boolean) => at(date, { galactic, fluctuations: {} });
		expect(
			marketSwitches([
				g('2230.01.01', false),
				at('2230.02.01', null),
				g('2230.03.01', true),
				g('2231.01.01', false)
			])
		).toEqual([
			{ date: '2230.03.01', galactic: true },
			{ date: '2231.01.01', galactic: false }
		]);
	});
});
