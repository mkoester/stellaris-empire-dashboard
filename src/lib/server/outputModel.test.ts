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
	// the game's job tooltip: stability 48.88 → Low Stability −1.11 % (Theian Preservers 2219.01)
	it('scales −50 % linearly from stability 50 down to 0', () => {
		expect(stabilitySource(48.883)[0].modifiers[0].value).toBeCloseTo(-0.01117, 5);
		expect(stabilitySource(0)[0].modifiers[0].value).toBe(-0.5);
	});
});
