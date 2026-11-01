import { describe, expect, it } from 'vitest';
import { formatSetting, readSetup, setupGroups } from './galaxySetup.ts';

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
		expect(groups.at(-1)!.rows).toEqual([
			{ key: 'core_radius', label: 'Core radius', value: '112.5' }
		]);
	});
});
