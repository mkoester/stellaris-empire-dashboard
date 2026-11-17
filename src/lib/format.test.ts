import { describe, expect, it } from 'vitest';
import { contactStage } from './format.ts';

describe('contactStage', () => {
	it('keeps only the number', () => {
		expect(contactStage('cutholoids_stage_1')).toBe(1);
		expect(contactStage('default_stage_2')).toBe(2);
	});
	it('a stage without a number has none', () => {
		expect(contactStage('default_end_stage_cautious')).toBeNull();
		expect(contactStage('default_hacking_stage_main')).toBeNull();
	});
});
