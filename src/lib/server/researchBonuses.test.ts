import { describe, expect, it } from 'vitest';
import { policyModifiers } from './researchBonuses.ts';

describe('policyModifiers', () => {
	// General Studies is an option of all three research policies; the data DB holds the physics one
	const physics = [
		{ key: 'country_physics_tech_research_speed', value: 0.1, label: null, positiveIsGood: true }
	];
	it('reads a research policy option with its own policy’s area', () => {
		expect(policyModifiers('society_research_policy', physics)[0].key).toBe(
			'country_society_tech_research_speed'
		);
		expect(policyModifiers('physics_research_policy', physics)).toEqual(physics);
	});
	it('leaves other policies alone', () => {
		expect(policyModifiers('economic_policy', physics)).toEqual(physics);
	});
});
