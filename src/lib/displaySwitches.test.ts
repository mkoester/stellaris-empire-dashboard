import { describe, expect, it } from 'vitest';
import { anyOn, effectiveDisplay, listed, SWITCH_GROUPS, SWITCHES } from './displaySwitches.ts';
import { DEFAULT_DISPLAY, parseDisplay } from './profiles.ts';

const sw = (key: string) => SWITCHES.find((s) => s.key === key)!;

describe('SWITCHES', () => {
	it('lists every switch of Display once, each in a known group', () => {
		const keys = Object.keys(DEFAULT_DISPLAY).filter(
			(k) => !['colonyRowLine', 'expansionRowLine', 'showSpoilers', 'showCheats'].includes(k)
		);
		expect(SWITCHES.map((s) => s.key).sort()).toEqual(keys.sort());
		for (const s of SWITCHES) expect(SWITCH_GROUPS).toContain(s.group);
	});
});

describe('effectiveDisplay', () => {
	const on = { ...DEFAULT_DISPLAY, wormholePairs: true, tradeIntel: true, unknownStars: true };
	it('hidden spoilers and cheats are off, the rest as stored', () => {
		const e = effectiveDisplay(on);
		expect(e.wormholePairs).toBe(false);
		expect(e.tradeIntel).toBe(false);
		expect(e.unknownStars).toBe(true);
	});
	it('shown, they are as stored', () => {
		const e = effectiveDisplay({ ...on, showSpoilers: true, showCheats: true });
		expect(e.wormholePairs).toBe(true);
		expect(e.tradeIntel).toBe(true);
	});
});

describe('parseDisplay: the gates', () => {
	it('a profile from before them keeps what it had on', () => {
		const d = parseDisplay({ lgates: true });
		expect(d.showSpoilers).toBe(true);
		expect(d.showCheats).toBe(false);
		expect(anyOn({}, 'spoiler')).toBe(false);
	});
	it('a stored gate wins', () => {
		expect(parseDisplay({ lgates: true, showSpoilers: false }).showSpoilers).toBe(false);
	});
});

describe('listed', () => {
	const shown = { showSpoilers: true, showCheats: false };
	it('hides kinds not shown', () => {
		expect(listed(sw('lgates'), shown, '')).toBe(true);
		expect(listed(sw('tradeIntel'), shown, '')).toBe(false);
	});
	it('matches every word of the query in label, note, group, tags or kind', () => {
		expect(listed(sw('wanderlustAll'), shown, 'nomads map')).toBe(true);
		expect(listed(sw('lgates'), shown, 'spoiler l-cluster')).toBe(true);
		expect(listed(sw('lgates'), shown, 'trade')).toBe(false);
	});
});
