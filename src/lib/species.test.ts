import { describe, expect, it } from 'vitest';
import { traitBudget } from './species.ts';
import type { GameData } from './types.ts';

describe('traitBudget', () => {
	const data = {
		traits: {
			trait_organic: { cost: 0 },
			trait_adaptive: { cost: 2 },
			trait_nomadic: { cost: 1 },
			trait_wasteful: { cost: -1 },
			trait_pc_continental_preference: { cost: null }
		},
		speciesClasses: { HUM: { name: 'Humanoid', archetype: 'BIOLOGICAL' } },
		archetypes: { BIOLOGICAL: { points: 2, maxTraits: 5 } }
	} as unknown as GameData;

	it('subtracts the traits from the archetype budget (UNE humans: 0 points, 2 picks left)', () => {
		const humans = {
			id: '1',
			name: 'Humans',
			cls: 'HUM',
			pops: 5210,
			traits: [
				'trait_organic',
				'trait_adaptive',
				'trait_nomadic',
				'trait_wasteful',
				'trait_pc_continental_preference'
			]
		};
		expect(traitBudget(humans, data)).toEqual({ points: 0, picks: 2, maxPoints: 2, maxPicks: 5 });
	});

	it('is unknown for a class the data does not know', () => {
		expect(traitBudget({ id: '2', name: 'X', cls: 'ZZZ', pops: 1, traits: [] }, data)).toBeNull();
	});
});
