import { describe, expect, it } from 'vitest';
import { stabilitySource } from './outputModel.ts';

describe('stabilitySource', () => {
	// the game's job tooltip: stability 73.345 → High Stability +14.01 % (Theian Preservers 2200.06)
	it('scales +30 % linearly from stability 50 to 100', () => {
		expect(stabilitySource(73.345)[0].modifiers[0].value).toBeCloseTo(0.1401, 4);
		expect(stabilitySource(100)[0].modifiers[0].value).toBe(0.3);
		expect(stabilitySource(120)[0].modifiers[0].value).toBe(0.3);
		expect(stabilitySource(50)).toEqual([]);
	});
});
