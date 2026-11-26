import { describe, expect, it } from 'vitest';
import { headingId } from './pageNav.ts';

describe('headingId', () => {
	it('slugs the heading, numbered when taken', () => {
		expect(headingId('Still to gain', () => false)).toBe('sec-still-to-gain');
		expect(headingId('L-Gate', (id) => id === 'sec-l-gate')).toBe('sec-l-gate-2');
		expect(headingId('★', () => false)).toBe('sec-section');
	});
});
