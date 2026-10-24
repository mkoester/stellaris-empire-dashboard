import { describe, expect, it } from 'vitest';
import { techOffers } from './techOffers.ts';
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
