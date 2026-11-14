import { describe, expect, it } from 'vitest';
import { defaultOf, formatSetting, readSetup, setupGroups } from './galaxySetup.ts';

// part of a 4.5.3 save's `galaxy` block (Roaming Korinth, 2207.02.01)
const RAW = {
	template: 'large',
	shape: 'elliptical',
	num_empires: 24,
	crises: 1.25,
	growth_scale: 0.25,
	difficulty: 'admiral',
	scaling: 'scaling_off',
	ironman: false,
	lgate_enabled: true,
	mid_game_start: 100,
	core_radius: 112.5,
	name: '877b116b-74ec-40ba-879d-56444f1ec6a9',
	disabled_precursors: ['precursor_3', 'precursor_baol_1']
};

describe('readSetup', () => {
	it('keeps plain values and lists, drops the galaxy id', () => {
		const s = readSetup(RAW)!;
		expect(s.name).toBeUndefined();
		expect(s.disabled_precursors).toEqual(['precursor_3', 'precursor_baol_1']);
		expect(s.crises).toBe(1.25);
	});
	it('nothing to read is null', () => {
		expect(readSetup(undefined)).toBeNull();
		expect(readSetup({})).toBeNull();
	});
});

describe('formatSetting', () => {
	it('formats by kind', () => {
		expect(formatSetting('mult', 1.25)).toBe('×1.25');
		expect(formatSetting('percent', 0.25)).toBe('25 %');
		expect(formatSetting('year', 100)).toBe('2300 (after 100 years)');
		expect(formatSetting('yesno', true)).toBe('yes');
		expect(formatSetting('yesno', 'no')).toBe('no');
		expect(formatSetting('text', 'scaling_off')).toBe('Off');
		expect(formatSetting('text', 'elliptical')).toBe('Elliptical');
		expect(formatSetting('list', [])).toBe('none');
		expect(formatSetting('list', ['precursor_3', 'x'], { precursor_3: 'First League' })).toBe(
			'First League, x'
		);
	});
});

describe('setupGroups', () => {
	it('groups as the setup screen, unknown keys under Other, empty groups left out', () => {
		const groups = setupGroups(readSetup(RAW)!, { precursor_baol_1: 'Baol' });
		expect(groups.map((g) => g.title)).toEqual([
			'Gameplay',
			'Galaxy',
			'Empires',
			'Precursors',
			'Game Length',
			'DLC',
			'Other'
		]);
		const galaxy = groups.find((g) => g.title === 'Galaxy')!;
		expect(galaxy.rows.map((r) => [r.label, r.value])).toEqual([
			['Galaxy Size', 'Large'],
			['Galaxy Shape', 'Elliptical']
		]);
		expect(groups.find((g) => g.title === 'Precursors')!.rows[0].value).toBe('precursor_3, Baol');
		expect(groups.at(-1)!.rows).toMatchObject([
			{ key: 'core_radius', label: 'Core radius', value: '112.5', default: null, changed: false }
		]);
	});

	// 4.5.4: data DB `setup_scenario` (large) and the defines
	const defaults = {
		scenarios: { large: { num_empires: 12, crises: 1.25 } },
		defines: { GROWTH_SCALE_DEFAULT: 0.25, MID_GAME_START_DEFAULT: 100 }
	};
	const rows = () => setupGroups(readSetup(RAW)!, {}, defaults).flatMap((g) => g.rows);
	const row = (key: string) => rows().find((r) => r.key === key)!;
	it('marks what differs from the default of its galaxy size', () => {
		expect(row('num_empires')).toMatchObject({ changed: true, default: '12', assumed: false });
		expect(row('crises')).toMatchObject({ changed: false, default: '×1.25' });
		expect(row('growth_scale')).toMatchObject({ changed: false });
		expect(row('mid_game_start')).toMatchObject({ changed: false });
	});
	it('takes the engine’s defaults as assumed, booleans as yes/no', () => {
		expect(row('difficulty')).toMatchObject({ changed: true, assumed: true });
		expect(row('ironman')).toMatchObject({ changed: false, assumed: true });
		expect(row('lgate_enabled')).toMatchObject({ changed: false });
		expect(row('shape')).toMatchObject({ default: null, changed: false });
	});
});

describe('defaultOf', () => {
	it('reads the cosmic storms’ caps by galaxy size', () => {
		const d = {
			scenarios: {},
			defines: { COSMIC_STORM_MID_GAME_SPAWN_MAX_CAP_DEFAULT_MEDIUM_GALAXY: 5 }
		};
		expect(defaultOf('cosmic_storm_mid_game_spawn_max_cap', 'medium', d)).toEqual({
			value: 5,
			assumed: false
		});
		expect(defaultOf('cosmic_storm_mid_game_spawn_max_cap', 'huge', d)).toBeNull();
	});
});
