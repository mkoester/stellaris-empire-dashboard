import { describe, expect, it } from 'vitest';
import {
	anyOn,
	barred,
	effectiveDisplay,
	listed,
	SWITCH_GROUPS,
	SWITCHES
} from './displaySwitches.ts';
import { DEFAULT_DISPLAY, parseDisplay } from './profiles.ts';

const sw = (key: string) => SWITCHES.find((s) => s.key === key)!;

describe('SWITCHES', () => {
	it('lists every switch of Display once, each in a known group', () => {
		const keys = Object.keys(DEFAULT_DISPLAY).filter(
			(k) =>
				![
					'colonyRowLine',
					'expansionRowLine',
					'slaveMarket',
					'showSpoilers',
					'showCheats'
				].includes(k)
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
	it('without cheats (multiplayer, Ironman) every cheat and intel spoiler is off; other spoilers as stored', () => {
		const all = Object.fromEntries(SWITCHES.map((s) => [s.key, true]));
		const e = effectiveDisplay(
			{ ...DEFAULT_DISPLAY, ...all, showSpoilers: true, showCheats: true },
			true
		);
		expect(SWITCHES.filter((s) => barred(s) && e[s.key])).toEqual([]);
		expect(e.showCheats).toBe(false);
		expect(e.wormholePairs).toBe(false);
		expect(e.wholeGalaxy).toBe(false);
		expect(e.anomalySpoilers).toBe(true);
		expect(e.unknownStars).toBe(true);
	});
	it('the intel spoilers: the map and contact reveals and pact intel', () => {
		expect(
			SWITCHES.filter((s) => s.intel)
				.map((s) => s.key)
				.sort()
		).toEqual([
			'contactStations',
			'contractSpoilers',
			'highwayFriends',
			'lgates',
			'pactIntel',
			'surveyAll',
			'wholeGalaxy',
			'wormholePairs'
		]);
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
	it('without cheats lists neither cheats nor intel spoilers', () => {
		const all = { showSpoilers: true, showCheats: true };
		expect(listed(sw('lgates'), all, '', true)).toBe(false);
		expect(listed(sw('tradeIntel'), all, '', true)).toBe(false);
		expect(listed(sw('anomalySpoilers'), all, '', true)).toBe(true);
	});
	it('matches every word of the query in label, note, group, tags or kind', () => {
		expect(listed(sw('wanderlustAll'), shown, 'nomads map')).toBe(true);
		expect(listed(sw('lgates'), shown, 'spoiler l-cluster')).toBe(true);
		expect(listed(sw('lgates'), shown, 'trade')).toBe(false);
	});
});
