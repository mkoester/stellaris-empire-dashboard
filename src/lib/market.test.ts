import { describe, expect, it } from 'vitest';
import {
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
