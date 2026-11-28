import { describe, expect, it } from 'vitest';
import { gainColor, progressColor, scaleColor } from './colors.ts';

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

describe('gainColor', () => {
	it('is plain at the baseline and grey below it', () => {
		expect(gainColor(2, 2, 5)).toBeNull();
		expect(gainColor(1, 2, 5)).toBe('worse');
	});
	it('runs from orange above the baseline to green at the best', () => {
		expect(gainColor(5, 2, 5)).toBe('hsl(120 70% 45%)');
		expect(gainColor(3.5, 2, 5)).toBe('hsl(75 70% 45%)');
		expect(gainColor(2.001, 2, 5)).toBe('hsl(30 70% 45%)');
	});
	it('is green when the only better value is the best', () => {
		expect(gainColor(3, 2, 2)).toBe('hsl(120 70% 45%)');
	});
});

describe('progressColor', () => {
	it('is red at 0, yellow at 50 and green from 75 on', () => {
		expect(progressColor(0)).toBe('hsl(0 70% 45%)');
		expect(progressColor(50)).toBe('hsl(60 70% 45%)');
		expect(progressColor(75)).toBe('hsl(120 70% 45%)');
		expect(progressColor(99)).toBe('hsl(120 70% 45%)');
	});
	it('runs a gradient between the stops', () => {
		expect(progressColor(25)).toBe('hsl(30 70% 45%)');
		expect(progressColor(62.5)).toBe('hsl(90 70% 45%)');
	});
	it('clamps what lies outside 0–100', () => {
		expect(progressColor(-5)).toBe('hsl(0 70% 45%)');
		expect(progressColor(140)).toBe('hsl(120 70% 45%)');
	});
});
