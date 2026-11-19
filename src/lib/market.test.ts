import { describe, expect, it } from 'vitest';
import {
	priceRecovery,
	basePrice,
	feeSeries,
	marketFee,
	marketSwitches,
	monthlyLimit,
	price,
	priceSeries
} from './market.ts';
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

const mods = (...keys: string[]) => keys.map((key) => ({ key, until: null }));

describe('marketFee', () => {
	const colony = (buildings: string[]) =>
		({
			districtList: [{ type: 'district_city', built: 1, zones: [{ type: 'z', buildings }] }]
		}) as never;
	const station = (modules: string[], buildings: string[]) => ({ modules, buildings }) as never;
	const snap = (s: object) =>
		upgrade({
			kind: 'save',
			campaign: 'c',
			date: '2250.01.01',
			traditions: [],
			countryModifiers: [],
			stations: [],
			...s
		});

	it('is 30 % with nothing lowering it', () => {
		expect(marketFee(snap({}))).toEqual({ fee: 0.3, sources: [] });
	});

	it('sums traditions, modifiers, buildings per planet and station buildings', () => {
		const f = marketFee(
			snap({
				traditions: ['tr_mercantile_insider_trading', 'tr_mercantile_adopt'],
				countryModifiers: mods('resolution_sanctions_economic', 'shroud_seal_modifier'),
				colonies: [
					colony(['building_galactic_stock_exchange']),
					colony(['building_galactic_stock_exchange'])
				],
				stations: [station([], ['trader_proxy_office'])]
			})
		);
		expect(f?.fee).toBeCloseTo(0.3 - 0.1 + 0.1 - 0.05 * 2 - 0.05); // 15 %
		expect(f?.sources.map((s) => [s.key, s.count])).toEqual([
			['tr_mercantile_insider_trading', 1],
			['resolution_sanctions_economic', 1],
			['building_galactic_stock_exchange', 2],
			['trader_proxy_office', 1]
		]);
	});

	it('never goes below 5 %, and raises with sanctions', () => {
		const low = snap({
			traditions: [
				'tr_mercantile_insider_trading',
				'tr_logistics_4',
				'tr_versatility_adaptive_programming'
			],
			countryModifiers: mods('galactic_market_founder')
		});
		expect(marketFee(low)?.fee).toBe(0.05);
		expect(marketFee(snap({ countryModifiers: mods('resolution_sanctions_economic') }))?.fee).toBe(
			0.4
		);
	});

	it('is unknown for snapshots without the data', () => {
		expect(marketFee(snap({ countryModifiers: null }))).toBeNull();
		expect(
			feeSeries([
				snap({}),
				upgrade({ kind: 'log', campaign: 'c', date: '2250.02.01' }),
				snap({ countryModifiers: null })
			]).lines['market fee %']
		).toEqual([30, null]);
	});
});

describe('priceRecovery', () => {
	const day = (date: string) => {
		const [y, m, d] = date.split('.').map(Number);
		return (y * 12 + m - 1) * 30 + d - 1;
	};
	const buy = (resource: string, amount: number) => ({ kind: 'buy' as const, resource, amount });
	const sell = (resource: string, amount: number) => ({ kind: 'sell' as const, resource, amount });

	it('the monthly swing of orders up to the buy limit is normal', () => {
		// on the 1st right after the trade: 42 energy +0.84, 10 alloys +0.8, 6 motes sold −0.36
		const orders = [buy('energy', 42), buy('alloys', 10), sell('volatile_motes', 6)];
		const d = day('2222.05.01');
		expect(priceRecovery('energy', 0.84, d, orders)).toEqual({ days: null, never: false });
		expect(priceRecovery('alloys', 0.8, d, orders)).toEqual({ days: null, never: false });
		expect(priceRecovery('volatile_motes', -0.36, d, orders)).toEqual({ days: null, never: false });
	});

	it('1000 food bought: back in about 2 years and 5 months', () => {
		// Roaming Cyber Gang 2223.10.01: food +18.70336 with 1 food bought a month. Closed form of
		// df/dt = −(a + b·f) down to 0.3: ln((a + b·18.7) / (a + b·0.3)) / b ≈ 867 days, and the
		// monthly +0.02 costs about a day a month more
		const r = priceRecovery('food', 18.70336, day('2223.10.01'), [buy('food', 1)]);
		expect(r.never).toBe(false);
		expect(r.days).toBeGreaterThanOrEqual(880);
		expect(r.days).toBeLessThanOrEqual(905);
	});

	it('reproduces the saves between two dates', () => {
		// 2223.09.20 food 18.94855 → 2223.10.01 18.70336 (after the 1st's +0.02): step the model
		// with a day limit by asking when it would be back from each, and compare the gap
		const a = priceRecovery('food', 18.94855, day('2223.09.20'), [buy('food', 1)]).days!;
		const b = priceRecovery('food', 18.70336, day('2223.10.01'), [buy('food', 1)]).days!;
		expect(Math.abs(a - b - 11)).toBeLessThanOrEqual(1);
	});

	it('orders beyond what a month recovers never get back', () => {
		expect(priceRecovery('food', 2, day('2223.10.01'), [buy('food', 100)]).never).toBe(true);
	});

	it('below base too, after selling a lot', () => {
		const r = priceRecovery('minerals', -5, day('2223.10.01'), []);
		expect(r.never).toBe(false);
		expect(r.days).toBeGreaterThan(30);
	});
});
