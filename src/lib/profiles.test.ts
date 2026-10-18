import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW } from './colonyTable.ts';
import {
	activeId,
	DEFAULT_SETTINGS,
	exportFile,
	importFile,
	parseProfiles,
	parseSettings,
	uniqueName
} from './profiles.ts';

const profiles = [
	{ id: 'a', name: 'Tall' },
	{ id: 'b', name: 'Wide' }
];

describe('parseSettings', () => {
	it('defaults what is missing or broken', () => {
		expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings({ tabs: 'x', display: { colonyRowLine: 'huge' } })).toEqual(
			DEFAULT_SETTINGS
		);
	});
	it('keeps what is well-formed', () => {
		const s = parseSettings({
			tabs: [{ id: 't1', name: 'mine', header: false, panels: ['jobs', 'nope'] }],
			display: { colonyRowLine: 'thick' },
			colonyView: { mode: 'sector' }
		});
		expect(s.tabs).toEqual([{ id: 't1', name: 'mine', header: false, panels: ['jobs'] }]);
		expect(s.display.colonyRowLine).toBe('thick');
		expect(s.colonyView).toEqual({ ...DEFAULT_VIEW, mode: 'sector' });
	});
});

describe('activeId', () => {
	it("prefers the campaign's own profile, then the last picked, then the first", () => {
		expect(activeId(profiles, 'a', { camp: 'b' }, 'camp')).toBe('b');
		expect(activeId(profiles, 'a', { camp: 'b' }, 'other')).toBe('a');
		expect(activeId(profiles, 'a', {}, null)).toBe('a');
		expect(activeId(profiles, 'gone', { camp: 'gone' }, 'camp')).toBe('a');
	});
});

describe('names, export and import', () => {
	it('makes names unique', () => {
		expect(uniqueName(' Wide ', ['Tall'])).toBe('Wide');
		expect(uniqueName('Wide', ['Wide', 'Wide (2)'])).toBe('Wide (3)');
		expect(uniqueName('', [])).toBe('profile');
	});
	it('reads back what it exports, and nothing else', () => {
		const settings = parseSettings({ display: { colonyRowLine: 'thin' } });
		expect(importFile(JSON.parse(JSON.stringify(exportFile('Wide', settings))))).toEqual({
			name: 'Wide',
			settings
		});
		expect(importFile({ name: 'x', settings: {} })).toBeNull();
		expect(importFile(null)).toBeNull();
	});
	it('reads the profile list', () => {
		expect(parseProfiles(profiles)).toEqual(profiles);
		expect(parseProfiles([])).toBeNull();
		expect(parseProfiles('x')).toBeNull();
	});
});
