import { describe, expect, it } from 'vitest';
import type { GameData } from '#lib/types.ts';
import { techNeeds } from './needs.ts';

const tech = (area: string, tier: number) => ({ name: area + tier, cost: 1, area, tier });
const techs = {
	mega: { ...tech('engineering', 5), name: 'Mega-Engineering' },
	pre: tech('engineering', 4),
	base: tech('engineering', 3),
	e3a: tech('engineering', 3),
	...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`e1_${i}`, tech('engineering', 1)])),
	...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`e2_${i}`, tech('engineering', 2)])),
	...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`e3_${i}`, tech('engineering', 3)]))
} as GameData['techs'];
const req = (prerequisites: string[]) => ({
	prerequisites,
	potential: null,
	rare: false,
	dangerous: false
});
const requirements = {
	mega: req(['pre']),
	pre: req(['base']),
	base: req([])
} as GameData['techRequirements'];
// six of tier 2 and five of tier 3 researched: tier 3 is open, tier 4 needs one more of tier 3
const researched = [
	...Array.from({ length: 6 }, (_, i) => `e1_${i}`),
	...Array.from({ length: 6 }, (_, i) => `e2_${i}`),
	...Array.from({ length: 5 }, (_, i) => `e3_${i}`)
];

describe('techNeeds', () => {
	it('lists the prerequisites not researched and every unmet tier gate, in order', () => {
		const out = techNeeds(['mega'], researched, techs, requirements);
		expect(out.map((g) => g.id)).toEqual([
			'auto-tier-engineering-3',
			'auto-tier-engineering-4',
			'auto-tech-base',
			'auto-tech-pre'
		]);
		expect(out[0]).toMatchObject({
			kind: 'tech_tier',
			target: { area: 'engineering', tier: 3, count: 6 },
			note: 'needed for Mega-Engineering'
		});
	});

	it('stops at what is researched, and names every tech a need is for', () => {
		const out = techNeeds(['mega', 'pre'], [...researched, 'base'], techs, requirements);
		// planned itself and needed by Mega-Engineering: listed, the plan keeps the one added by hand
		expect(out.find((g) => g.id === 'auto-tech-pre')?.note).toBe('needed for Mega-Engineering');
		expect(out.find((g) => g.id === 'auto-tier-engineering-4')?.note).toBe(
			'needed for Mega-Engineering'
		);
		// `base` researched makes six of tier 3: that gate is met
		expect(out.find((g) => g.id === 'auto-tier-engineering-3')).toBeUndefined();
	});

	it('takes from an OR group the alternative the empire can get, and names the other', () => {
		const t = {
			mega: { ...tech('engineering', 1), name: 'Mega-Engineering' },
			starbase: { ...tech('engineering', 1), name: 'Starbase 5' },
			ark: { ...tech('engineering', 1), name: 'Arkship III' }
		} as GameData['techs'];
		const r = {
			mega: { ...req([]), anyOf: [['ark', 'starbase']] },
			starbase: { ...req([]), potential: { leaf: 'is_nomadic', value: 'no' } },
			ark: req([])
		} as unknown as GameData['techRequirements'];
		const nomad = (p: unknown) => (p ? false : true);
		const out = techNeeds(['mega'], [], t, r, nomad);
		expect(out.map((g) => [g.id, g.note])).toEqual([
			['auto-tech-ark', 'needed for Mega-Engineering — or instead Starbase 5']
		]);
		expect(techNeeds(['mega'], ['starbase'], t, r, nomad)).toEqual([]); // one of the group is done
	});

	it('takes the bio hulls for a bio-ship empire (Stingers, not Battleships)', () => {
		const t = {
			mega: { ...tech('engineering', 1), name: 'Mega-Engineering' },
			tech_battleships: { ...tech('engineering', 1), name: 'Battleships' },
			tech_stingers: { ...tech('engineering', 1), name: 'Stingers' }
		} as GameData['techs'];
		const usesBio = (v: string) => ({ leaf: 'country_uses_bio_ships', value: v });
		const r = {
			mega: { ...req([]), anyOf: [['tech_battleships', 'tech_stingers']] },
			tech_battleships: { ...req([]), potential: usesBio('no') },
			tech_stingers: { ...req([]), potential: usesBio('yes') }
		} as unknown as GameData['techRequirements'];
		const bioEmpire = (p: unknown) => (p ? (p as { value: string }).value === 'yes' : true);
		expect(techNeeds(['mega'], [], t, r, bioEmpire).map((g) => [g.id, g.note])).toEqual([
			['auto-tech-tech_stingers', 'needed for Mega-Engineering — or instead Battleships']
		]);
	});
});
