import { describe, expect, it } from 'vitest';
import { diploWeight } from './diploWeight.ts';

const mod = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: true });

describe('diploWeight', () => {
	it("rebuilds the game's tooltip: 22 + 136 + 163 + 74 = 395 (2214.02.01)", () => {
		const w = diploWeight(
			{ military: 738.45, economy: 904.07, tech: 742.5, pops: 5875, happiness: 0.657 },
			[
				{ name: 'The Readied Shield', modifiers: [mod('diplo_weight_naval_mult', 0.2)] },
				{ name: 'Regulatory Facilitation', modifiers: [mod('diplo_weight_economy_mult', 0.2)] },
				{ name: 'Council member', modifiers: [mod('diplo_weight_council_mult', 0.2)] }
			],
			395.06
		);
		expect(w.parts.map((p) => [p.label, Math.floor(p.raw), Math.floor(p.value)])).toEqual([
			['Fleet Power', 18, 22],
			['Pops', 135, 135],
			['Economy', 135, 162],
			['Technology', 74, 74]
		]);
		expect(Math.abs(w.total - 395.06)).toBeLessThan(1);
		expect(w.parts[0].mods).toEqual([{ name: 'The Readied Shield', value: 0.2 }]);
		expect(w.notCounted.map((m) => m.key)).toEqual(['diplo_weight_council_mult']);
	});

	it('applies diplo_weight_mult to the whole', () => {
		const w = diploWeight(
			{ military: 0, economy: 1000, tech: 0, pops: 0, happiness: null },
			[{ name: 'Politics', modifiers: [mod('diplo_weight_mult', 0.1)] }],
			null
		);
		expect(w.total).toBeCloseTo(165);
	});
});
