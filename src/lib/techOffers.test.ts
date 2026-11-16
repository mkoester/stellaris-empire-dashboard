import { describe, expect, it } from 'vitest';
import { plannedOnOffer, techOffers, withLiveOptions } from './techOffers.ts';
import type { Snapshot } from './types.ts';

const snap = (date: string, cards: string[], researching: string | null) =>
	({
		date,
		techOptions: { physics: cards },
		progress: researching
			? { research: [{ area: 'physics', tech: researching, progress: 0 }] }
			: null
	}) as unknown as Snapshot;

describe('techOffers', () => {
	it('merges saves with the same cards into one offer, with the tech picked from it', () => {
		const offers = techOffers([
			snap('2200.01.01', ['a', 'b'], null),
			snap('2200.02.01', ['b', 'a'], 'b'),
			snap('2200.05.01', ['c', 'd'], 'd'),
			{ date: '2200.06.01', techOptions: null } as unknown as Snapshot
		]);
		expect(offers).toEqual([
			{ area: 'physics', cards: ['a', 'b'], from: '2200.01.01', to: '2200.02.01', picked: 'b' },
			{ area: 'physics', cards: ['c', 'd'], from: '2200.05.01', to: '2200.05.01', picked: 'd' }
		]);
	});
});

describe('plannedOnOffer', () => {
	const names = { a: { name: 'Alpha' }, b: { name: 'Beta' } };
	const wanted = new Map([
		['a', { stance: 'want' as const, note: '' }],
		['b', { stance: 'want' as const, note: 'needed for Gamma' }]
	]);
	const saves = [snap('2200.01.01', ['x', 'y'], 'x'), snap('2200.02.01', ['a', 'b', 'c'], 'c')];
	const run = (s = saves, dismissed = new Set<string>()) =>
		plannedOnOffer(s, wanted, names, dismissed);

	it('gives a planned tech on offer a row to dismiss, from the first save of the offer', () => {
		const rows = run([...saves, snap('2200.03.01', ['c', 'b', 'a'], 'c')]);
		// in the order of the cards; the same cards reshuffled are still the offer of 2200.02.01
		expect(rows.map((r) => [r.what, r.dismiss, r.detail, r.act, r.kind])).toEqual([
			[
				'Beta',
				'country:offer:b:2200.02.01',
				'physics · on offer since 2200.02.01 · needed for Gamma',
				true,
				'offer'
			],
			['Alpha', 'country:offer:a:2200.02.01', 'physics · on offer since 2200.02.01', true, 'offer']
		]);
		expect(rows[0].date).toBe('2200.03.01');
	});

	it('drops a tech being researched, unplanned cards and dismissed offers', () => {
		const picked = [snap('2200.01.01', ['a', 'b', 'c'], 'a')];
		expect(run(picked).map((r) => r.what)).toEqual(['Beta']);
		expect(run(saves, new Set(['country:offer:a:2200.02.01'])).map((r) => r.what)).toEqual([
			'Beta'
		]);
		expect(run([snap('2200.01.01', ['x', 'y'], null)])).toEqual([]);
	});

	it('makes a later draw offering the tech again a new row', () => {
		const again = [
			...saves,
			snap('2200.03.01', ['x', 'z'], 'x'),
			snap('2200.04.01', ['a', 'z'], 'z')
		];
		expect(run(again, new Set(['country:offer:a:2200.02.01']))[0].dismiss).toBe(
			'country:offer:a:2200.04.01'
		);
	});

	it('tells to pick another card for a tech planned for later or to avoid', () => {
		const stances = new Map([
			['a', { stance: 'later' as const, note: '' }],
			['b', { stance: 'avoid' as const, note: '' }]
		]);
		const rows = plannedOnOffer(saves, stances, names, new Set());
		expect(rows.map((r) => [r.what, r.sub, r.detail])).toEqual([
			[
				'Alpha',
				'later',
				'physics · on offer since 2200.02.01 · planned for later: pick another card for now'
			],
			[
				'Beta',
				'avoided tech',
				'physics · on offer since 2200.02.01 · planned to avoid: pick another card'
			]
		]);
	});
});

describe('withLiveOptions', () => {
	const saves = [snap('2200.02.01', ['a', 'b'], 'a')];
	const area = (t: string) => ({ a: 'physics', c: 'physics', s: 'society' })[t];

	it("adds the mod's newer list as a reading after the last save, by field", () => {
		const out = withLiveOptions(saves, { date: '2200.02.02', techs: ['c', 's'] }, area);
		expect(out).toHaveLength(2);
		expect(out[1].date).toBe('2200.02.02');
		// the tech under research joins its field's cards, as in a save
		expect(out[1].techOptions).toEqual({ physics: ['c', 'a'], society: ['s'] });
		// the research under way is the last save's
		expect(out[1].progress).toBe(saves[0].progress);
	});

	it('leaves the saves alone without a newer list', () => {
		expect(withLiveOptions(saves, null, area)).toBe(saves);
		expect(withLiveOptions(saves, { date: '2200.02.01', techs: ['c'] }, area)).toBe(saves);
		expect(withLiveOptions(saves, { date: '2200.01.02', techs: ['c'] }, area)).toBe(saves);
	});
});
