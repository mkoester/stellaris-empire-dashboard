import { describe, expect, it } from 'vitest';
import type { Facts } from './triggers.ts';
import { actualOutlook, aiVote, opinionFactor, outlook, type AiWeight } from './votes.ts';

// 4.5.2 Buzzword Standardization, shortened: loved (7), megacorps ×2, gestalts ×0.1
const BUZZWORD: AiWeight = {
	base: 7,
	modifiers: [
		{ factor: 2, add: null, trigger: { leaf: 'is_megacorp', value: 'yes' } },
		{ factor: 0.1, add: null, trigger: { leaf: 'is_gestalt', value: 'yes' } }
	]
};
const empire = (government: string[]): Facts =>
	({
		countryType: 'default',
		government,
		origin: null,
		governmentType: null,
		dlcs: null,
		policyFlags: null,
		countryFlags: null,
		traditions: null,
		perks: null,
		techs: null,
		atWar: null,
		situations: null,
		nomadic: null
	}) as unknown as Facts;
const democracy = empire(['ethic_egalitarian', 'auth_democratic']);

describe('opinionFactor', () => {
	it('runs from 0.5 at Terrible over 1 at neutral to 1.3 at Excellent', () => {
		expect(opinionFactor(-750)).toBe(0.5);
		expect(opinionFactor(-2000)).toBe(0.5);
		expect(opinionFactor(0)).toBe(1);
		expect(opinionFactor(750)).toBeCloseTo(1.3);
		expect(opinionFactor(375)).toBeCloseTo(1.15);
	});
});

describe('aiVote', () => {
	it("matches the game's likely supporters of Buzzword Standardization (2214.02.01)", () => {
		// Dekron at −12 just below the threshold: abstains; Hydari at +109 supports
		expect(aiVote(BUZZWORD, democracy, -12)?.vote).toBe('abstain');
		expect(aiVote(BUZZWORD, democracy, 109)?.vote).toBe('for');
		expect(aiVote(BUZZWORD, democracy, -371)?.vote).toBe('against');
	});

	it('applies the factors whose conditions hold, and marks unknown ones', () => {
		expect(aiVote(BUZZWORD, empire(['auth_corporate']), 0)?.weight).toBeCloseTo(14);
		expect(aiVote(BUZZWORD, empire(['auth_hive_mind']), 0)?.vote).toBe('against');
		const unknownCivic: AiWeight = {
			base: 6,
			modifiers: [{ factor: 2, add: null, trigger: { leaf: 'has_country_flag', value: 'x' } }]
		};
		expect(aiVote(unknownCivic, democracy, 0)).toMatchObject({ weight: 6, uncertain: true });
	});
});

describe('outlook', () => {
	it('gives the share of the decided weight for it, as we vote for, abstain or against', () => {
		const o = outlook(
			BUZZWORD,
			[
				{ name: 'A', weight: 500, facts: democracy, opinionOfUs: 300 },
				{ name: 'B', weight: 300, facts: democracy, opinionOfUs: -400 },
				{ name: 'C', weight: 100, facts: democracy, opinionOfUs: -10 }
			],
			200
		)!;
		expect(o.votes.map((v) => v.vote)).toEqual(['for', 'against', 'abstain']);
		expect(o.ifAbstain).toBeCloseTo(500 / 800);
		expect(o.ifFor).toBeCloseTo(700 / 1000);
		expect(o.ifAgainst).toBeCloseTo(500 / 1000);
	});
});

describe('actualOutlook', () => {
	it('counts the votes cast, our own set aside, the undecided on neither side', () => {
		const weights = { us: { value: 200 }, A: { value: 500 }, B: { value: 300 }, C: { value: 100 } };
		// we are against it, A for, B against, C undecided
		const o = actualOutlook(
			{ support: ['A'], oppose: ['us', 'B'] },
			weights,
			['us', 'A', 'B', 'C'],
			'us'
		);
		expect(o.ifAbstain).toBeCloseTo(500 / 800);
		expect(o.ifFor).toBeCloseTo(700 / 1000);
		expect(o.ifAgainst).toBeCloseTo(500 / 1000);
		expect(o.votes.map((v) => [v.name, v.vote])).toEqual([
			['A', 'for'],
			['B', 'against'],
			['C', null]
		]);
	});
});
