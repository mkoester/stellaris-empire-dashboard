import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STARBASE_VIEW,
	freeSlots,
	levelSlots,
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

describe('levelSlots', () => {
	it('counts from the ship size where it has a capacity', () => {
		// starbase_starport: lists 2 modules and 1 building; Slightly Larger Starbases [4.5] makes it 3
		expect(
			levelSlots(
				{ modules: 2, buildings: 1 },
				{
					starbase_module_capacity_add: 3,
					starbase_building_capacity_add: 1,
					ship_sensor_range_add: 1
				}
			)
		).toEqual({ modules: 3, buildings: 1 });
		// Outpost Slots: an outpost lists none, its ship size gets one of each
		expect(
			levelSlots(
				{ modules: 0, buildings: 0 },
				{ starbase_module_capacity_add: 1, starbase_building_capacity_add: 1 }
			)
		).toEqual({ modules: 1, buildings: 1 });
	});

	it('keeps the listed slots without a capacity (a level without one, an older data DB)', () => {
		expect(levelSlots({ modules: 0, buildings: 1 }, { starbase_building_capacity_add: 1 })).toEqual(
			{
				modules: 0,
				buildings: 1
			}
		);
		expect(levelSlots({ modules: 2, buildings: 1 }, null)).toEqual({ modules: 2, buildings: 1 });
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
