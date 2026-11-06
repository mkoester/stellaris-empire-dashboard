import { describe, expect, it } from 'vitest';
import {
	commercialSplit,
	ourSpeciesAbroad,
	pactTypes,
	researchValue,
	speciesExchange,
	techCounts,
	techHints,
	tradeBase
} from './pacts.ts';
import type { AiIntel, Relation, Snapshot } from './types.ts';

const rel = (countryId: number, agreements: string[]) =>
	({ countryId, name: `E${countryId}`, agreements }) as Relation;

describe('pactTypes', () => {
	it('lists the types we hold with partners and the booked upkeep', () => {
		const t = pactTypes(
			[rel(1, ['commercial_pact', 'research_agreement']), rel(2, ['commercial_pact', 'embassy'])],
			[{ source: 'commercial_pacts', income: { trade: 4 }, expenses: { influence: 0.5 } }]
		);
		expect(t.map((x) => [x.key, x.partners.length, x.upkeep])).toEqual([
			['commercial_pact', 2, 0.5],
			['research_agreement', 1, 0]
		]);
		expect(t[0].gain).toEqual({ trade: 4 });
	});
});

describe('commercialSplit', () => {
	// Pyrragthul Planetforgers 2214.02.01: three partners, 46.85 booked
	it('is 10 % of each partner’s trade production', () => {
		const ai = (trade: number, pact: number) =>
			({ income: { trade }, commercialPactTrade: pact }) as unknown as AiIntel;
		const bases = [ai(292.54, 48.66318), ai(174.17, 15.60373), ai(90.86, 25.03296)].map(tradeBase);
		const r = commercialSplit(
			46.84577,
			bases.map((base, i) => ({ countryId: i, base }))
		);
		expect(r.predicted).toBeCloseTo(46.83, 1);
		expect(r.shares.map((s) => Math.round(s.trade! * 100) / 100)).toEqual([24.39, 15.86, 6.58]);
	});
	it('leaves the rest to the partners we do not know', () => {
		const r = commercialSplit(10, [
			{ countryId: 1, base: 60 },
			{ countryId: 2, base: null }
		]);
		expect(r.shares[1].trade).toBeNull();
		expect(r.rest).toBe(4);
	});
});

const info = (k: string) => ({
	cost: { a: 1000, b: 2000, c: 500 }[k] ?? 0,
	area: k === 'c' ? 'society' : 'physics'
});

describe('researchValue', () => {
	it('saves 20 % of each tech only the other side has, this month 25 % of the area’s output', () => {
		const v = researchValue(
			7,
			['a', 'b'],
			['c'],
			info,
			new Set(['a']),
			[
				{ area: 'physics', tech: 'b' },
				{ area: 'society', tech: 'x' }
			],
			{ physics: 40, society: 30 }
		);
		expect(v.ours.techs.map((t) => t.key)).toEqual(['a', 'b']); // in reach first
		expect(v.ours.savedInReach).toBeCloseTo(200);
		expect(v.ours.saved).toBeCloseTo(600);
		expect(v.theirs).toEqual({ count: 1, saved: 100 });
		expect(v.thisMonth).toEqual([{ area: 'physics', tech: 'b', extra: 10 }]);
	});
});

describe('techCounts', () => {
	it('derives the partner’s count per area from ours and the gaps', () => {
		expect(techCounts(['c', 'd'], ['a', 'b'], ['c'], (k) => info(k).area)).toEqual([
			{ area: 'physics', ours: 1, theirs: 3 },
			{ area: 'society', ours: 1, theirs: 0 },
			{ area: 'engineering', ours: 0, theirs: 0 }
		]);
	});
});

describe('techHints', () => {
	it('ranks the cards on offer first, then by research saved, counting a tech once', () => {
		const h = techHints(
			[
				{ countryId: 1, weLack: ['a', 'b'] },
				{ countryId: 2, weLack: ['b', 'z'] }
			],
			new Set(['a']),
			new Set(['b']),
			info
		);
		expect(h.map((x) => [x.key, x.partners, x.saved])).toEqual([
			['a', [1], 200],
			['b', [1, 2], 400]
		]);
	});
});

describe('speciesExchange', () => {
	const at = (date: string, ours: number, theirsHere: number, oursThere: number) =>
		({
			date,
			speciesByEmpire: [
				{
					countryId: 0,
					founder: 'Human',
					species: [
						{ name: 'Human', pops: ours },
						{ name: 'Blorg', pops: theirsHere }
					]
				},
				{
					countryId: 5,
					founder: 'Blorg',
					species: [
						{ name: 'Blorg', pops: 900 },
						{ name: 'Human', pops: oursThere }
					]
				}
			]
		}) as unknown as Snapshot;
	it('follows our main species there and theirs here', () => {
		const [x] = speciesExchange(
			[
				at('2210.01.01', 1000, 0, 0),
				{ date: '2210.01.15', speciesByEmpire: null } as Snapshot,
				at('2210.02.01', 990, 4, 10)
			],
			0
		);
		expect(x).toMatchObject({
			countryId: 5,
			ourSpecies: 'Human',
			theirSpecies: 'Blorg',
			theirsHere: 4
		});
		expect(x.oursThere).toEqual([]); // the main species is the chart's
		expect(x.series.lines).toEqual({ 'Human in theirs': [0, 10], 'Blorg in ours': [0, 4] });
	});
});

describe('ourSpeciesAbroad', () => {
	const at = (date: string, theirs: { countryId: number; pops: number; onlyOurs?: true }[]) =>
		({
			date,
			speciesByEmpire: [
				{ countryId: 0, founder: 'Theian', species: [{ name: 'Theian', pops: 5000 }] },
				...theirs.map((t) => ({
					countryId: t.countryId,
					founder: 'Baanthurian',
					species: [
						{ name: 'Baanthurian', pops: 5000 },
						{ name: 'Theian', pops: t.pops }
					].filter((x) => x.pops > 0),
					...(t.onlyOurs && { onlyOurs: t.onlyOurs })
				}))
			]
		}) as unknown as Snapshot;
	// throwaway Theian Preservers: the Baanthurian treaty ended, 338 Theians stayed
	it('keeps our emigrants in view after a treaty ends, with the change since first seen', () => {
		const a = ourSpeciesAbroad(
			[
				at('2204.01.01', [{ countryId: 5, pops: 0 }]),
				at('2210.01.01', [{ countryId: 5, pops: 200 }]),
				at('2214.01.01', [{ countryId: 5, pops: 338, onlyOurs: true }])
			],
			0
		);
		expect(a).toEqual([
			{
				countryId: 5,
				partner: false,
				first: '2210.01.01',
				species: [{ name: 'Theian', pops: 338, since: 138 }]
			}
		]);
	});
});
