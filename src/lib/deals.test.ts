import { describe, expect, it } from 'vitest';
import { dealEnd, dealFlowSeries, dealHistory, sideSummary } from './deals.ts';
import type { DealSide, TradeDeal } from './types.ts';
import { upgrade } from './upgrade.ts';

const side = (s: Partial<DealSide> = {}): DealSide => ({ monthly: {}, once: {}, other: [], ...s });
const deal = (id: string, gives: Partial<DealSide>, gets: Partial<DealSide>): TradeDeal => ({
	id,
	partner: 'Tzynn',
	start: '2230.05.01',
	years: 10,
	gives: side(gives),
	gets: side(gets),
	understood: true,
	raw: ''
});
const at = (date: string, tradeDeals: TradeDeal[] | null) =>
	upgrade({ kind: tradeDeals ? 'save' : 'log', campaign: 'c', date, tradeDeals });

describe('dealEnd', () => {
	it('adds the length in years', () => {
		expect(dealEnd({ start: '2230.05.01', years: 10 })).toBe('2240.05.01');
		expect(dealEnd({ start: '2230.05.01', years: null })).toBeNull();
	});
});

describe('sideSummary', () => {
	it('lists monthly and one-off resources, then the rest', () => {
		expect(
			sideSummary(
				side({ monthly: { energy: 10 }, once: { minerals: 200 }, other: ['sensor_link'] })
			)
		).toBe('10 energy/month, 200 minerals, sensor link');
		expect(sideSummary(side())).toBe('nothing');
	});
});

describe('dealFlowSeries', () => {
	it('nets monthly resources over the deals of each save, mod months left out', () => {
		const a = deal('1', { monthly: { energy: 10 } }, { monthly: { minerals: 20 } });
		const b = deal('2', {}, { monthly: { energy: 4 } });
		expect(
			dealFlowSeries([at('2230.01.01', [a]), at('2230.02.01', null), at('2230.03.01', [a, b])])
		).toEqual({
			x: [2230, 2230 + 2 / 12],
			lines: { energy: [-10, -6], minerals: [20, 20] }
		});
	});
});

describe('dealHistory', () => {
	it('dates each deal by the saves showing it, newest first, marking the running ones', () => {
		const a = deal('1', {}, {});
		const b = deal('2', {}, {});
		expect(
			dealHistory([at('2230.01.01', [a]), at('2231.01.01', [a, b]), at('2232.01.01', [b])]).map(
				(e) => [e.deal.id, e.firstSeen, e.lastSeen, e.active]
			)
		).toEqual([
			['2', '2231.01.01', '2232.01.01', true],
			['1', '2230.01.01', '2231.01.01', false]
		]);
	});
});

describe('upgrade', () => {
	it('turns a deal stored as a one-line summary into one with sides', () => {
		const s = upgrade({
			kind: 'save',
			campaign: 'c',
			date: '2230.01.01',
			tradeDeals: [{ id: '5', partner: 'Tzynn', items: 'energy 10' } as never]
		});
		expect(s.tradeDeals?.[0]).toMatchObject({ understood: false, gives: { other: ['energy 10'] } });
	});
});
