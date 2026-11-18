import { describe, expect, it } from 'vitest';
import {
	acceptance,
	advise,
	commercialGain,
	pactUpkeep,
	requirements,
	researchGain,
	type Other,
	type Us
} from './pactAdvice.ts';
import type { AiIntel, Relation } from './types.ts';

// 4.5.4 defines (common/defines/00_defines.txt)
const defines: Record<string, number> = {
	OPINION_GOOD: 300,
	...Object.fromEntries(
		(['RESEARCH_AGREEMENT', 'COMMERCIAL_PACT'] as const).flatMap((p) => [
			[`${p}_ACCEPTANCE_OPINION_FACTOR`, 0.4],
			[`${p}_ACCEPTANCE_ATTITUDE_ALLIANCE`, 100],
			[`${p}_ACCEPTANCE_ATTITUDE_COEXIST`, 50],
			[`${p}_ACCEPTANCE_OTHER_ATTITUDE`, 0],
			[`${p}_ACCEPTANCE_NUM_PACTS`, -30],
			[`${p}_ACCEPTANCE_DISTANCE_MULT`, -0.1]
		])
	),
	RESEARCH_AGREEMENT_ACCEPTANCE_GIVEN_TECHS: -0.5,
	RESEARCH_AGREEMENT_ACCEPTANCE_TAKEN_TECHS: -0.5,
	RESEARCH_AGREEMENT_ACCEPTANCE_TECHS_MIN: -100,
	RESEARCH_AGREEMENT_ACCEPTANCE_TECHS_MAX: 100,
	COMMERCIAL_PACT_ACCEPTANCE_GIVEN_VALUE: -0.5,
	COMMERCIAL_PACT_ACCEPTANCE_GIVEN_VALUE_MIN: -100,
	COMMERCIAL_PACT_ACCEPTANCE_GIVEN_VALUE_MAX: 0,
	COMMERCIAL_PACT_ACCEPTANCE_TAKEN_VALUE: 1,
	COMMERCIAL_PACT_ACCEPTANCE_TAKEN_VALUE_MIN: 0,
	COMMERCIAL_PACT_ACCEPTANCE_TAKEN_VALUE_MAX: 100
};
const data = {
	defines,
	personalities: {
		erudite_explorers: {
			name: 'Erudite Explorers',
			willingness: 1,
			acceptance: { research: 50, commercial: 10 }
		}
	},
	attitudes: {
		cordial: { name: 'Cordial', trade: true, alliance: false, coexist: true },
		friendly: { name: 'Friendly', trade: true, alliance: true, coexist: true },
		wary: { name: 'Wary', trade: true, alliance: false, coexist: false }
	}
};
const ai = (over: Partial<AiIntel> = {}): AiIntel => ({
	countryId: 7,
	nomadic: false,
	personality: 'erudite_explorers',
	attitude: 'cordial',
	opinion: 100,
	trust: 25,
	opinionModifiers: [],
	stockpile: {},
	net: {},
	income: { trade: 120 },
	commercialPactTrade: 20,
	techsWeLack: ['tech_a', 'tech_b'],
	theyLackCount: 10,
	...over
});
const relation = (over: Partial<Relation> = {}): Relation => ({
	countryId: 7,
	name: 'Kel',
	contact: true,
	communications: true,
	hostile: false,
	opinion: 50,
	trust: 0,
	threat: 0,
	borderRange: 100,
	agreements: ['embassy'],
	...over
});
const other = (over: Partial<Other> = {}): Other => ({
	countryId: 7,
	name: 'Kel',
	type: 'default',
	civics: [],
	subject: false,
	ai: ai(),
	relation: relation(),
	pacts: { research: 1, commercial: 0 },
	...over
});
const us: Us = {
	civics: [],
	traditions: [],
	perks: [],
	megacorp: false,
	subject: false,
	tradeBase: 80
};

describe('acceptance', () => {
	it('sums the research agreement terms', () => {
		// −50 base, +40 opinion, +50 cordial, +50 erudite, −30 one pact, −10 distance, −6 techs
		const a = acceptance('research', other(), us, data);
		expect(a.terms.map((t) => t.value)).toEqual([-50, 40, 50, 50, -30, -10, -6]);
		expect(a.total).toBeCloseTo(44);
		expect(a.accepts).toBeNull(); // an upper bound: the game showed −13 where this read +156
	});
	it('sums the commercial pact terms on the shares passed on', () => {
		// they give 10 % of 100 (trade less pacts' trade): −5; they get 10 % of 80: +8
		const a = acceptance('commercial', other(), us, data);
		expect(a.terms.slice(-2).map((t) => t.value)).toEqual([-5, 8]);
		expect(a.total).toBeCloseTo(-50 + 40 + 50 + 10 + 0 - 10 - 5 + 8);
	});
	it('refuses without the distance when the rest is not positive', () => {
		// no relation read: the distance is unknown, and never positive
		const far = other({ ai: ai({ attitude: 'wary', opinion: 0 }), relation: null });
		const a = acceptance('research', far, us, data);
		expect(a.total).toBeNull();
		expect(a.accepts).toBe(false);
		const friendly = other({ ai: ai({ attitude: 'friendly' }), relation: null });
		expect(acceptance('research', friendly, us, data).accepts).toBeNull();
	});
	it('reads no border (a nomad’s, 2217.06.01) as no distance term', () => {
		const nomad = acceptance(
			'research',
			other({ relation: relation({ borderRange: null }) }),
			us,
			data
		);
		expect(nomad.terms[5]).toEqual({ label: 'border distance (no border)', value: -0 });
		expect(nomad.total).toBeCloseTo(54);
	});
	it('cannot tell on an older data DB', () => {
		const old = { ...data, attitudes: { cordial: { name: 'Cordial', trade: true } } };
		expect(acceptance('research', other(), us, old).accepts).toBeNull();
	});
});

describe('requirements', () => {
	it('asks for trust or good opinion, and an embassy', () => {
		expect(requirements('research', other(), us, 300)).toEqual([]);
		const cold = other({ ai: ai({ trust: 12.5 }), relation: relation({ agreements: [] }) });
		expect(requirements('research', cold, us, 300)).toEqual([
			'needs 20 trust (has 12)',
			'needs an embassy with them'
		]);
		expect(
			requirements(
				'research',
				other({ ai: ai({ trust: 0 }), relation: relation({ opinion: 300 }) }),
				us,
				300
			)
		).toEqual([]);
	});
	it('takes Diplomatic Networking for an embassy, Universal Transactions for a megacorp’s trade', () => {
		const noEmbassy = other({ relation: relation({ agreements: [] }) });
		expect(
			requirements(
				'research',
				noEmbassy,
				{ ...us, traditions: ['tr_diplomacy_diplomatic_networking'] },
				300
			)
		).toEqual([]);
		const corp = { ...us, megacorp: true, perks: ['ap_universal_transactions'] };
		expect(requirements('commercial', noEmbassy, corp, 300)).toEqual([]);
		expect(requirements('research', noEmbassy, corp, 300)).toEqual(['needs an embassy with them']);
	});
});

describe('gains', () => {
	it('counts the techs in reach they have and no partner gives', () => {
		const info = (k: string) => ({ cost: { a: 100, b: 300, c: 600 }[k] ?? 0, area: 'physics' });
		// in reach a, b, c (1000); they have a and b, a partner already gives a → 300 of 1000
		const g = researchGain(['a', 'b'], ['a', 'b', 'c'], new Set(['a']), info, { physics: 40 });
		expect(g).toEqual({ physics_research: 0.25 * 40 * 0.3 });
	});
	it('takes 10 % of their trade production', () => {
		expect(commercialGain(ai())).toBeCloseTo(10);
	});
});

describe('advise', () => {
	it('ranks by value and keeps a refused one in place, greyed', () => {
		const rich = other({
			countryId: 1,
			name: 'Rich',
			ai: ai({ income: { trade: 500 }, commercialPactTrade: 0, trust: 0 })
		});
		const poor = other({ countryId: 2, name: 'Poor' });
		const has = other({ countryId: 3, relation: relation({ agreements: ['commercial_pact'] }) });
		const out = advise(
			'commercial',
			[poor, rich, has],
			us,
			data,
			(o) => ({ trade: commercialGain(o.ai) }),
			(r) => Object.values(r).reduce((n, v) => n + v, 0),
			0.25
		)!;
		expect(out.map((a) => [a.name, a.available])).toEqual([
			['Rich', false],
			['Poor', true]
		]);
		expect(out[0].why).toEqual(['needs 20 trust (has 0)']);
		expect(out[0].value).toBeCloseTo(50 - 0.25);
	});
	it('offers nothing an empire of ours can never sign', () => {
		expect(
			advise(
				'research',
				[other()],
				{ ...us, civics: ['civic_inwards_perfection'] },
				data,
				() => ({}),
				() => 0,
				0.25
			)
		).toBeNull();
		expect(
			advise(
				'research',
				[other({ type: 'fallen_empire' })],
				us,
				data,
				() => ({}),
				() => 0,
				0.25
			)
		).toEqual([]);
	});
});

describe('pactUpkeep', () => {
	const type = (key: string, upkeep: number, n = 1) => ({
		key: key as never,
		name: key,
		partners: Array.from({ length: n }, (_, i) => ({ countryId: i, name: `p${i}` })),
		upkeep,
		gain: {}
	});
	it('takes the kind’s own booking per partner', () => {
		expect(pactUpkeep('commercial', [type('commercial_pact', 0.8, 2)])).toEqual({
			amount: 0.4,
			from: 'own'
		});
	});
	it('scales the base by another type’s booking (Roaming Korinth 2217.07.01: Isolationist)', () => {
		// a guarantee booked 1 for 0.5: ×2 → 0.50 (the game offered 0.40: the ruler's nomad discount)
		expect(pactUpkeep('commercial', [type('guarantee', 1)])).toEqual({
			amount: 0.5,
			from: 'other'
		});
		expect(pactUpkeep('research', [])).toEqual({ amount: 0.25, from: 'base' });
	});
});
