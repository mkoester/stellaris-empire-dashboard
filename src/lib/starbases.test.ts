import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STARBASE_VIEW,
	freeSlots,
	parseStarbaseView,
	shownStations,
	type StarbaseView
} from './starbases.ts';
import type { Station } from './types.ts';

const station = (id: number, level: string, yard: boolean, modules: string[] = []): Station => ({
	id,
	system: `S${id}`,
	systemId: id,
	level,
	modules,
	buildings: [],
	queue: [],
	slots: 1,
	shipyard: yard ? { queue: [], slots: 2 } : null,
	arkship: false
});

const stations = [
	station(1, 'starport', true, ['shipyard']),
	station(2, 'starhold', false),
	station(3, 'outpost', false)
];
const view = (v: Partial<StarbaseView>) => ({ ...DEFAULT_STARBASE_VIEW, ...v });
const ids = (s: Station[]) => s.map((x) => x.id);

describe('shownStations', () => {
	it('hides outposts unless asked', () => {
		expect(ids(shownStations(stations, view({})))).toEqual([1, 2]);
		expect(ids(shownStations(stations, view({ outposts: true })))).toEqual([1, 2, 3]);
	});
	it('splits shipyards from the rest', () => {
		expect(ids(shownStations(stations, view({ yard: 'yards' })))).toEqual([1]);
		expect(ids(shownStations(stations, view({ yard: 'plain', outposts: true })))).toEqual([2, 3]);
	});
});

describe('freeSlots', () => {
	const slots = { starport: { modules: 2, buildings: 1 } };
	it('takes the built ones off the level', () => {
		expect(freeSlots(stations[0], slots)).toEqual({ modules: 1, buildings: 1 });
	});
	it('is unknown for a level the data DB lacks', () => {
		expect(freeSlots(stations[1], slots)).toEqual({ modules: null, buildings: null });
	});
});

describe('parseStarbaseView', () => {
	it('keeps what is valid and defaults the rest', () => {
		expect(parseStarbaseView({ yard: 'yards', outposts: true, range: '3' })).toEqual({
			yard: 'yards',
			outposts: true,
			range: '3'
		});
		expect(parseStarbaseView({ yard: 'x', range: '99' })).toEqual(DEFAULT_STARBASE_VIEW);
		expect(parseStarbaseView(null)).toEqual(DEFAULT_STARBASE_VIEW);
	});
});
