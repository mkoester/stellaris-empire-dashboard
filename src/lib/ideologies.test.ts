import { describe, expect, it } from 'vitest';
import { ambitionsWhy, isRevealed, levelOf } from './ambitions.ts';
import {
	ideologiesWhy,
	knownIds,
	levelProgress,
	offeredTier,
	ownIdeologies
} from './ideologies.ts';
import { emptyTabs } from './tabData.ts';
import type { AmbitionPath, Ideology, IdeologyReading, Snapshot } from './types.ts';

const ideology = (id: number, extra: Partial<Ideology> = {}): Ideology => ({
	id,
	type: 'egalitarian',
	name: `Ideology ${id}`,
	founder: id,
	custodian: id,
	adopters: [id],
	tenets: [],
	offered: [],
	systems: 0,
	...extra
});
const stand = (countryId: number, adopted: number | null, intel: Record<string, number>) => ({
	countryId,
	adopted,
	strength: 0,
	level: 0,
	momentum: null,
	pendingLevels: 0,
	intel
});

// 2200.05.01 of the throwaway: we adopted 18, talk to the custodian of 3, and 1 and 2 are unknown
const reading: IdeologyReading = {
	enabled: true,
	ideologies: [ideology(1), ideology(2), ideology(3), ideology(18)],
	stands: [stand(0, 18, { 3: 15, 18: 100 }), stand(1, 1, { 1: 100, 2: 15, 3: 15 })]
};

describe('ideologies we know', () => {
	it("are our intel's keys and the one we adopted", () => {
		expect([...knownIds(reading, 0)].sort((a, b) => a - b)).toEqual([3, 18]);
		expect([...knownIds({ ...reading, stands: [stand(0, 18, {})] }, 0)]).toEqual([18]);
	});
	it('pages get only those and our own stand', () => {
		const own = ownIdeologies(reading, 0);
		expect(own.ideologies.map((i) => i.id)).toEqual([3, 18]);
		expect(own.stands.map((s) => s.countryId)).toEqual([0]);
	});
	it('the tab says why it is empty: rule off, or nothing adopted or known', () => {
		expect(ideologiesWhy(reading, 0)).toBeNull();
		expect(ideologiesWhy({ ...reading, enabled: false }, 0)).toBe(
			'ideologies are off in this galaxy'
		);
		expect(ideologiesWhy({ ...reading, stands: [] }, 0)).toBe('no ideology adopted or known yet');
		expect(ideologiesWhy(null, 0)).toBe('no ideology read yet');
	});
});

describe('strength levels', () => {
	it('slot marks at 250, 500 and 750; progress within the band', () => {
		expect(levelProgress(0.38)).toEqual({ level: 0, next: 250, share: 0.38 / 250 });
		expect(levelProgress(500)).toEqual({ level: 2, next: 750, share: 0 });
		expect(levelProgress(796.77)).toMatchObject({ level: 3, next: null });
	});
	it('a choice on offer fills the slot after the codified ones', () => {
		expect(offeredTier({ tenets: [{ key: 'a', tier: 1 }] }, 0)).toBe(2);
		expect(offeredTier({ tenets: [] }, 0)).toBe(1);
	});
});

describe('ambitions', () => {
	const nemesis = {
		countryId: 7,
		path: 'nemesis_path',
		level: 'crisis_level_1',
		personality: 'became_the_crisis'
	};
	it('are revealed by a personality that names them, to empires that talk to them', () => {
		expect(isRevealed(nemesis, new Set([7]))).toBe(true);
		expect(isRevealed(nemesis, new Set())).toBe(false);
		expect(isRevealed({ ...nemesis, personality: 'hegemonic_imperialists' }, new Set([7]))).toBe(
			false
		);
		// Force of Will's personality only from level 2; Behemoths have none
		expect(isRevealed({ ...nemesis, path: 'behemoth_path', personality: null }, new Set([7]))).toBe(
			false
		);
	});
	it('a level key counts by the path, 0 before the first', () => {
		const path = {
			levels: [
				{ key: 'crisis_level_1', level: 1 },
				{ key: 'crisis_level_2', level: 2 }
			]
		} as AmbitionPath;
		expect(levelOf(nemesis, path)).toBe(1);
		expect(levelOf({ level: null }, path)).toBe(0);
	});
	it('the tab is empty until we take one', () => {
		expect(ambitionsWhy([nemesis], 0)).toBe('no ambition taken yet');
		expect(ambitionsWhy([{ ...nemesis, countryId: 0 }], 0)).toBeNull();
	});
});

describe('the tab bar', () => {
	const snap = (s: Partial<Snapshot>) =>
		({ countryId: 0, ideologies: null, ambitions: null, ...s }) as Snapshot;
	it('dims both tabs until we know an ideology or take an ambition', () => {
		const empty = emptyTabs([snap({ ideologies: { ...reading, stands: [] }, ambitions: [] })]);
		expect(empty.ideologies).toBe('no ideology adopted or known yet');
		expect(empty.ambitions).toBe('no ambition taken yet');
		const full = emptyTabs([
			snap({
				ideologies: reading,
				ambitions: [{ countryId: 0, path: 'force_of_will_path', level: null, personality: null }]
			})
		]);
		expect(full.ideologies).toBeUndefined();
		expect(full.ambitions).toBeUndefined();
	});
	it('never dims them for snapshots from before READER 79 (unknown, not empty)', () => {
		const old = emptyTabs([snap({})]);
		expect(old.ideologies).toBeUndefined();
		expect(old.ambitions).toBeUndefined();
	});
});
