import { describe, expect, it } from 'vitest';
import { totalEffects } from './effects.ts';

const mod = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: true });

describe('totalEffects', () => {
	const totals = totalEffects([
		{ name: 'Xenophile', modifiers: [mod('refugee_attraction', 0.15), mod('envoys_add', 1)] },
		{ name: 'Democratic', modifiers: [mod('faction_approval', 0.1)] },
		{
			name: 'Beacon of Liberty',
			modifiers: [mod('refugee_attraction', 0.25), mod('add_attunement_the_cradle_of_souls', 60)]
		}
	]);

	it('adds up a modifier over its sources and keeps each part', () => {
		const refugees = totals.find((t) => t.mod.key === 'refugee_attraction')!;
		expect(refugees.mod.value).toBeCloseTo(0.4);
		expect(refugees.sources).toEqual([
			{ name: 'Xenophile', value: 0.15 },
			{ name: 'Beacon of Liberty', value: 0.25 }
		]);
	});

	it('keeps a part’s kind for its badge', () => {
		const [t] = totalEffects([
			{ name: 'Machine Intelligence', modifiers: [mod('envoys_add', 1)], kind: 'authority' }
		]);
		expect(t.sources).toEqual([{ name: 'Machine Intelligence', value: 1, kind: 'authority' }]);
	});

	it('keeps the order modifiers first appear in', () => {
		expect(totals.map((t) => t.mod.key)).toEqual([
			'refugee_attraction',
			'envoys_add',
			'faction_approval'
		]);
	});

	it('keeps a total that cancels out, so the sources show why', () => {
		const [t] = totalEffects([
			{ name: 'A', modifiers: [mod('x_mult', 0.1)] },
			{ name: 'B', modifiers: [mod('x_mult', -0.1)] }
		]);
		expect(t.mod.value).toBe(0);
		expect(t.sources).toHaveLength(2);
	});

	it('does not touch the sources', () => {
		const m = mod('envoys_add', 1);
		totalEffects([
			{ name: 'A', modifiers: [m] },
			{ name: 'B', modifiers: [m] }
		]);
		expect(m.value).toBe(1);
	});
});
