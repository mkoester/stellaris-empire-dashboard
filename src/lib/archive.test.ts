import { describe, expect, it } from 'vitest';
import {
	blockers,
	exhibitions,
	type EmpireFacts,
	holds,
	refusals,
	specimenDeal,
	specimenGives,
	sumBonuses,
	tradeEnergy
} from './archive.ts';
import type { ArchiveHolding, Exhibit, Specimen } from './types.ts';

const facts: EmpireFacts = {
	gestalt: false,
	lithoid: false,
	infernal: null,
	consumerGoods: true,
	flags: ['had_lava_sports']
};

const mod = (key: string, value: number, condition: string | null = null) => ({
	key,
	value,
	label: null,
	positiveIsGood: true,
	condition
});

const spores: Specimen = {
	name: 'Acidic Spores',
	category: 'xeno_geology',
	rarity: 'common',
	tradable: true,
	sellable: true,
	modifiers: [
		mod('planet_jobs_food_produces_mult', 0.02, 'is_lithoid = no, is_infernal = no'),
		mod('planet_jobs_minerals_produces_mult', 0.02, 'is_lithoid = yes'),
		mod('planet_stability_add', 1)
	],
	produces: { unity: 5 }
};
const specimens = { acidic_spores: spores };

const exhibit = (
	id: number,
	specimen: string,
	category: string | null,
	active = true
): Exhibit => ({
	id,
	specimen,
	category,
	unlocked: active,
	active,
	added: null,
	exhibited: null
});

const holding = (exhibits: Exhibit[], tradeUntil: string | null = null): ArchiveHolding => ({
	countryId: 0,
	exhibits: exhibits.filter((e) => e.category),
	storage: exhibits.filter((e) => !e.category),
	tradeUntil,
	mults: null
});

describe('holds', () => {
	it('evaluates the conditions the specimens use', () => {
		expect(holds(null, facts)).toBe(true);
		expect(holds('is_gestalt = no', facts)).toBe(true);
		expect(holds('is_lithoid = yes', facts)).toBe(false);
		expect(holds('country_uses_consumer_goods = yes', facts)).toBe(true);
		expect(holds('has_country_flag = had_lava_sports', facts)).toBe(true);
	});

	it('cannot tell an unknown fact, unless another part fails', () => {
		expect(holds('is_lithoid = no, is_infernal = no', facts)).toBeNull();
		expect(holds('is_lithoid = yes, is_infernal = no', facts)).toBe(false);
		expect(holds('NOT', facts)).toBeNull();
		expect(holds('(is_lithoid = yes OR is_gestalt = no)', facts)).toBe(true);
	});
});

describe('exhibitions', () => {
	it('gives the active exhibits’ modifiers and resources × the category’s multiplier', () => {
		const h = holding([exhibit(1, 'acidic_spores', 'xeno_geology')]);
		const [aw, , xg] = exhibitions(h, { specimens }, facts, { xeno_geology: 1.5 });
		expect(aw.exhibits).toEqual([]);
		expect(xg.bonuses.map((b) => [b.key, b.value, b.applies])).toEqual([
			['planet_jobs_food_produces_mult', 0.03, null],
			['planet_stability_add', 1.5, true]
		]);
		expect(xg.produces).toEqual({ unity: 7.5 });
	});

	it('gives nothing for an exhibit not activated, but says what it would', () => {
		const h = holding([exhibit(1, 'acidic_spores', 'xeno_geology', false)]);
		const xg = exhibitions(h, { specimens }, facts, { xeno_geology: 2 })[2];
		expect(xg.bonuses).toEqual([]);
		expect(xg.exhibits[0].gives?.bonuses.map((b) => b.value)).toEqual([0.04, 2]);
		expect(xg.exhibits[0].gives?.produces).toEqual({ unity: 10 });
	});

	it('leaves out a modifier whose condition fails', () => {
		const lithoid = { ...facts, lithoid: true };
		expect(specimenGives(spores, lithoid).bonuses.map((b) => b.key)).toEqual([
			'planet_jobs_minerals_produces_mult',
			'planet_stability_add'
		]);
	});

	it('sums the same modifier over specimens', () => {
		const h = holding([
			exhibit(1, 'acidic_spores', 'xeno_geology'),
			exhibit(2, 'acidic_spores', 'xeno_geology')
		]);
		const sum = sumBonuses(exhibitions(h, { specimens }, facts)[2].bonuses);
		expect(sum.find((b) => b.key === 'planet_stability_add')?.value).toBe(2);
		expect(sum[1].sources).toEqual(['Acidic Spores', 'Acidic Spores']);
	});
});

describe('trade', () => {
	it('values a specimen by rarity, more to an empire whose category is empty or nearly full', () => {
		expect(tradeEnergy(spores, undefined)).toBe(325);
		expect(tradeEnergy(spores, holding([]))).toBe(487.5);
		const eight = holding(Array.from({ length: 8 }, (_, i) => exhibit(i, `s${i}`, 'xeno_geology')));
		expect(tradeEnergy(spores, eight)).toBe(406.25);
		expect(
			tradeEnergy({ ...spores, rarity: 'exceptional' }, holding([exhibit(1, 'x', 'xeno_geology')]))
		).toBe(2600);
	});

	it('prices a deal by the personality’s willingness', () => {
		expect(specimenDeal(spores, holding([]), 0.5)).toEqual({ price: 650, bid: 243.75 });
		expect(specimenDeal(spores, holding([]), 0).price).toBeNull();
	});

	it('names what blocks a trade', () => {
		const ctx = { date: '2226.08.01', receiverIsUs: true };
		const ours = holding([exhibit(1, 'acidic_spores', 'xeno_geology')]);
		const theirs = holding([], '2230.01.01');
		expect(blockers(spores, 'acidic_spores', theirs, ours, ctx)).toEqual([
			'we have it already',
			'they traded specimens recently: not before 2230.01.01'
		]);
		expect(
			blockers(spores, 'acidic_spores', theirs, holding([]), { ...ctx, date: '2231.01.01' })
		).toEqual([]);
		expect(blockers({ ...spores, tradable: false }, 'x', null, null, ctx)).toEqual([
			'this specimen cannot be traded'
		]);
	});

	it('names why the AI would refuse', () => {
		expect(refusals({ opinion: 500, trades: true })).toEqual([
			'their opinion of us (500) is under 750'
		]);
		expect(refusals({ opinion: 800, trades: false })).toEqual([
			'their attitude or personality trades nothing'
		]);
		expect(refusals({ opinion: null, trades: true })).toEqual([]);
	});
});
