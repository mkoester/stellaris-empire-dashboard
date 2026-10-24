import { describe, expect, it } from 'vitest';
import { scaleColor } from './colors.ts';

describe('scaleColor', () => {
	it('runs from red at the worst to green at the best', () => {
		expect(scaleColor(-20, -20, 80)).toBe('hsl(0 70% 45%)');
		expect(scaleColor(30, -20, 80)).toBe('hsl(60 70% 45%)');
		expect(scaleColor(80, -20, 80)).toBe('hsl(120 70% 45%)');
	});
	it('has no colour when all values are equal', () => {
		expect(scaleColor(5, 5, 5)).toBeNull();
	});
});
