import { describe, expect, it } from 'vitest';
import {
	holdings,
	loyaltyFromOpinion,
	loyaltySeries,
	loyaltyTrend,
	proposalCost,
	renegotiation,
	specialist
} from './subjects.ts';
import type { ExternalBuildings, Snapshot, Specialists, Subject } from './types.ts';

// UNE 6's Silicron Sacred Nation (throwaway game, 4.5.4): our vassal since 2200.11.01
const silicron: Subject = {
	countryId: 1,
	name: 'Silicron Sacred Nation',
	weAreOverlord: true,
	preset: 'preset_vassal',
	since: '2200.11.01',
	terms: { specialist_type: 'specialist_none', subject_holdings_limit: 'subject_holdings_limit_1' },
	subsidies: {},
	specialistLevel: 0,
	specialistExperience: 0,
	loyalty: 92.81,
	changed: '2200.11.01',
	firstCooldown: true,
	conversion: null,
	stance: null,
	power: null
};

const defines = {
	AGREEMENT_CHANGE_COOLDOWN_MONTHS: 60,
	AGREEMENT_PROPOSE_INFLUENCE_COST: 50,
	AGREEMENT_LOYALTY_DELTA_MULT: 5,
	SUBJECT_MONTHLY_LOYALTY_OPINION_MULTIPLIER: 0.01,
	SUBJECT_XP_LOYALTY_MULTIPLIER: 0.1
};

describe('renegotiation', () => {
	it('waits 60 months from the last change', () => {
		expect(renegotiation(silicron, '2208.02.01', defines)).toEqual({
			from: '2205.11.01',
			now: true
		});
		expect(renegotiation(silicron, '2204.01.01', defines)).toEqual({
			from: '2205.11.01',
			now: false
		});
	});
	it('is open at once for a deal never changed without the first cooldown', () => {
		const s = { ...silicron, firstCooldown: false };
		expect(renegotiation(s, '2201.01.01', defines)).toEqual({ from: '2200.11.01', now: true });
	});
	it('cannot tell without the date (an older reading)', () => {
		expect(renegotiation({ ...silicron, changed: null }, '2201.01.01', defines)).toBeNull();
	});
});

describe('costs and rates', () => {
	it('prices a proposal by the loyalty it moves', () => {
		expect(proposalCost(-10, defines)).toBe(100);
	});
	it('turns opinion into loyalty a month', () => {
		expect(loyaltyFromOpinion(120, defines)).toBeCloseTo(1.2);
		expect(loyaltyFromOpinion(null, defines)).toBeNull();
	});
});

const snap = (date: string, loyalty: number | null): Snapshot =>
	({
		kind: 'save',
		date,
		subjects: [{ ...silicron, loyalty }]
	}) as unknown as Snapshot;

describe('loyalty over time', () => {
	const snaps = [snap('2207.01.01', 80), snap('2207.07.01', 86), snap('2208.01.01', 92)];
	it('charts each save', () => {
		const s = loyaltySeries(snaps, 1);
		expect(s.lines.loyalty).toEqual([80, 86, 92]);
		expect(s.x).toHaveLength(3);
	});
	it('measures the last change a month', () => {
		expect(loyaltyTrend(snaps, 1)).toBeCloseTo(1);
		expect(loyaltyTrend(snaps.slice(0, 1), 1)).toBeNull();
	});
});

const data: Specialists = {
	types: {
		specialist_bulwark: {
			name: 'Bulwark',
			preferredEthic: 'ethic_militarist',
			levels: [
				{ level: 1, xpNext: 1200, perks: ['bulwark_1_modifier'] },
				{ level: 2, xpNext: 3600, perks: ['bulwark_2_modifier'] },
				{ level: 3, xpNext: null, perks: ['bulwark_3_modifier'] }
			]
		}
	},
	perks: {}
};

describe('specialist', () => {
	it('is null without a specialisation', () => {
		expect(specialist(silicron, data, defines)).toBeNull();
	});
	it('counts the months to the next level at today’s loyalty', () => {
		const s = {
			...silicron,
			terms: { specialist_type: 'specialist_bulwark' },
			specialistLevel: 1,
			specialistExperience: 600,
			loyalty: 50
		};
		expect(specialist(s, data, defines)).toMatchObject({
			name: 'Bulwark',
			level: 1,
			xpNext: 1200,
			perMonth: 5,
			months: 120,
			nextPerks: ['bulwark_2_modifier']
		});
	});
	it('has nothing next at the top level', () => {
		const s = {
			...silicron,
			terms: { specialist_type: 'specialist_bulwark' },
			specialistLevel: 3
		};
		expect(specialist(s, data, defines)).toMatchObject({
			xpNext: null,
			months: null,
			nextPerks: []
		});
	});
});

describe('holdings', () => {
	const ext = (ownerId: number, holderId: number): ExternalBuildings =>
		({ kind: 'subject_holding', ownerId, holderId, buildings: ['b'] }) as ExternalBuildings;
	it('counts our holdings on its colonies against the limit', () => {
		expect(holdings(silicron, [ext(1, 0), ext(2, 0), ext(1, 3)], 0)).toEqual({ used: 1, limit: 1 });
	});
	it('is null for our overlord or without the reading', () => {
		expect(holdings({ ...silicron, weAreOverlord: false }, [], 0)).toBeNull();
		expect(holdings(silicron, null, 0)).toBeNull();
	});
});
