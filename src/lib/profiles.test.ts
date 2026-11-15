import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW } from './colonyTable.ts';
import {
	activeId,
	DEFAULT_SETTINGS,
	exportFile,
	importFile,
	parsePatch,
	parseProfiles,
	parseSettings,
	parseStringMap,
	parseStrings,
	SETTING_PARSERS,
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

describe('parsePatch', () => {
	it('reads the settings named, and only those', () => {
		expect(parsePatch({})).toEqual({});
		expect(parsePatch(null)).toEqual({});
		expect(parsePatch({ colonyView: { mode: 'sector' }, theme: 'dark', nope: 1 })).toEqual({
			colonyView: { ...DEFAULT_VIEW, mode: 'sector' }
		});
	});
	it('names the first setting that cannot be read', () => {
		expect(parsePatch({ tabs: 'x' })).toEqual({ malformed: 'tabs' });
		expect(parsePatch({ display: {}, chartEvents: [] })).toEqual({ malformed: 'chartEvents' });
	});
	it('knows every setting of a profile', () => {
		expect(Object.keys(SETTING_PARSERS).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
	});
});

describe('stored lists and maps', () => {
	it('drops what is not a string', () => {
		expect(parseStrings(['a', 1, null, 'b'])).toEqual(['a', 'b']);
		expect(parseStrings({ a: 1 })).toEqual([]);
		expect(parseStringMap({ c1: 'p1', c2: 2 })).toEqual({ c1: 'p1' });
		expect(parseStringMap(['p1'])).toEqual({});
		expect(parseStringMap(undefined)).toEqual({});
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
