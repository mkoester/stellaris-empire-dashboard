import { describe, expect, it } from 'vitest';
import { techCard, unlockLine } from './techCard.ts';

describe('techCard', () => {
	it('prefixes derived unlocks as the game card does and keeps an own line as written', () => {
		expect(unlockLine({ kind: 'building', label: 'Field Dynamics Center', detail: null })).toBe(
			'Unlocks Building: Field Dynamics Center'
		);
		expect(
			unlockLine({ kind: 'line', label: 'Unlocks Ship Type: Science Ship', detail: 'x' })
		).toBe('Unlocks Ship Type: Science Ship');
		expect(unlockLine({ kind: 'feature', label: null, detail: null })).toBeNull();
	});

	it('lists area, tier, cost, rarity, what it needs (OR groups too) and what it leads to', () => {
		const card = techCard({
			area: 'engineering',
			tier: 5,
			cost: 24000,
			rare: true,
			dangerous: false,
			unlocks: [{ kind: 'feature', label: 'Megastructures', detail: null }],
			needs: ['Zero-Point Power'],
			needsAny: [['Battleships', 'Stingers'], ['Starbase V']],
			leadsTo: ['Dyson Sphere']
		});
		expect(card.facts).toEqual([
			'engineering, tier 5',
			'base cost 24,000',
			'rare',
			'needs Zero-Point Power, Battleships or Stingers, Starbase V',
			'leads to Dyson Sphere'
		]);
		expect(card.unlocks).toEqual(['Unlocks Feature: Megastructures']);
	});
});
