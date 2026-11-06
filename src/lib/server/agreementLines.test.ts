import { describe, expect, it } from 'vitest';
import { pileSum } from '#lib/researchBonuses.ts';
import type { Snapshot } from '#lib/types.ts';
import { agreementLines } from './researchBonuses.ts';

// throwaway Theian Preservers 2200.07: Quantum Computing in progress, Baanthurian Council has it
const s = {
	relations: [
		{ countryId: 5, name: 'Baanthurian Council', agreements: ['embassy', 'research_agreement'] },
		{ countryId: 6, name: 'Other', agreements: ['embassy'] }
	],
	aiIntel: [
		{ countryId: 5, techsWeLack: ['tech_physics_1'] },
		{ countryId: 6, techsWeLack: ['tech_society_1'] }
	],
	progress: {
		research: [
			{ area: 'physics', tech: 'tech_physics_1', progress: 116 },
			{ area: 'society', tech: 'tech_society_1', progress: 112 }
		]
	}
} as unknown as Snapshot;

describe('agreementLines', () => {
	it('+25 % on the tech in progress a research partner has, for that tech only', () => {
		const lines = agreementLines(s);
		expect(lines).toEqual([
			expect.objectContaining({
				name: 'Research agreement (Baanthurian Council)',
				pile: 'speed',
				scope: { kind: 'tech', tech: 'tech_physics_1' },
				value: 0.25
			})
		]);
		expect(pileSum(lines, 'speed', 'physics', { key: 'tech_physics_1' })).toBe(0.25);
		expect(pileSum(lines, 'speed', 'physics', { key: 'tech_other' })).toBe(0);
	});
});
