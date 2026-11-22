import { describe, expect, it } from 'vitest';
import { contactStage } from './format.ts';

describe('contactStage', () => {
	it('keeps only the number, as the game counts it (base_contact_set is stage 1)', () => {
		expect(contactStage('cutholoids_stage_1')).toBe(2);
		expect(contactStage('default_stage_2')).toBe(3);
	});
	it('a stage without a number has none', () => {
		expect(contactStage('default_end_stage_cautious')).toBeNull();
		expect(contactStage('default_hacking_stage_main')).toBeNull();
	});
});
