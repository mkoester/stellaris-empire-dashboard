import { describe, expect, it } from 'vitest';
import { PANELS, parseTabs, parseTheme } from './settings.ts';

describe('parseTheme', () => {
	it('takes the three themes and nothing else', () => {
		expect(['system', 'light', 'dark'].map(parseTheme)).toEqual(['system', 'light', 'dark']);
		expect(parseTheme('blue')).toBeNull();
		expect(parseTheme(undefined)).toBeNull();
	});
});

describe('parseTabs', () => {
	it('keeps well-formed tabs, trimming names and dropping unknown or repeated panels', () => {
		expect(
			parseTabs([
				{
					id: 'a1',
					name: '  Economy ',
					panels: ['resources', 'nope', 'chart-income', 'resources']
				},
				{ id: 'b2', name: '', panels: [] }
			])
		).toEqual([
			{ id: 'a1', name: 'Economy', panels: ['resources', 'chart-income'] },
			{ id: 'b2', name: 'tab', panels: [] }
		]);
	});

	it('rejects what is not a list of tabs', () => {
		expect(parseTabs({})).toBeNull();
		expect(parseTabs([{ id: 'a', name: 'x' }])).toBeNull();
		expect(parseTabs([{ id: '../x', name: 'x', panels: [] }])).toBeNull();
		expect(
			parseTabs([
				{ id: 'a', name: 'x', panels: [] },
				{ id: 'a', name: 'y', panels: [] }
			])
		).toBeNull();
	});
});

describe('PANELS', () => {
	it('names every panel once', () => {
		const ids = PANELS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
