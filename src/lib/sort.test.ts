import { describe, expect, it } from 'vitest';
import { pinFirst } from './sort.ts';

describe('pinFirst', () => {
	it('puts the pinned rows first, each part in its order', () => {
		expect(pinFirst([1, 2, 3, 4, 5], (n) => n % 2 === 0)).toEqual([2, 4, 1, 3, 5]);
		expect(pinFirst([1, 3], (n) => n > 5)).toEqual([1, 3]);
	});
});
