import { describe, expect, it } from 'vitest';
import { capitalYardMissing, megaStage } from './shipyards.ts';
import type { Station } from './types.ts';

const station = (over: Partial<Station>): Station => ({
	id: 0,
	system: 'Sol',
	level: 'starport',
	modules: ['shipyard'],
	buildings: [],
	queue: [],
	slots: 1,
	shipyard: { queue: [], slots: 1 },
	arkship: false,
	...over
});

describe('shipyards', () => {
	it('names what a starbase lacks for capital ships', () => {
		expect(capitalYardMissing(station({}))).toEqual(['citadel', 'capital assembly yards']);
		expect(capitalYardMissing(station({ level: 'citadel', buildings: ['capital_yards'] }))).toEqual(
			[]
		);
		expect(
			capitalYardMissing(station({ arkship: true, modules: ['arkship_capital_shipyard'] }))
		).toEqual([]);
	});

	it('reads mega shipyard stages', () => {
		expect(megaStage('mega_shipyard_1')).toBe('stage 1 of 3');
		expect(megaStage('mega_shipyard_3')).toBe('complete');
		expect(megaStage('mega_shipyard_ruined')).toBe('ruined');
	});
});
