import { describe, expect, it } from 'vitest';
import {
	bySector,
	DEFAULT_VIEW,
	filterRows,
	netResources,
	NO_FILTERS,
	parseView,
	problems,
	sectorColors,
	sortRows,
	totals,
	type ColonyRow
} from './colonyTable.ts';
import { CATEGORICAL } from './migration.ts';

const row = (name: string, r: Partial<ColonyRow> = {}): ColonyRow =>
	({
		planetId: name.length,
		name,
		sector: 'Earth',
		designation: 'col_city',
		pops: 10,
		net: {},
		room: 0,
		blockers: 0,
		problems: [],
		profile: { pros: [], cons: [], suits: [], mismatch: null },
		...r
	}) as ColonyRow;

describe('problems', () => {
	const ok = {
		stability: 60,
		freeHousing: 1,
		freeAmenities: 0,
		habitability: 0.8,
		civilians: 2,
		pops: 10
	};
	it('is empty for a healthy colony', () => expect(problems(ok)).toEqual([]));
	it('names each shortage', () =>
		expect(
			problems({
				stability: 42.4,
				freeHousing: -3,
				freeAmenities: -1.2,
				habitability: 0.6,
				civilians: 3,
				pops: 10
			})
		).toEqual([
			'stability 42 (below 50)',
			'housing short by 3',
			'amenities short by 1',
			'habitability 60%',
			'30% of pops without a job'
		]));
});

describe('sectors', () => {
	const rows = [
		row('Earth'),
		row('Sirius', { sector: 'Cradle' }),
		row('Mars'),
		row('X', { sector: null })
	];
	it('gives each sector a colour, in order of appearance', () =>
		expect(sectorColors(rows)).toEqual({
			Earth: CATEGORICAL[0],
			Cradle: CATEGORICAL[1],
			'(no sector)': CATEGORICAL[2]
		}));
	it('groups rows by sector', () =>
		expect(bySector(rows).map((g) => [g.sector, g.rows.map((r) => r.name)])).toEqual([
			['Earth', ['Earth', 'Mars']],
			['Cradle', ['Sirius']],
			['(no sector)', ['X']]
		]));
	it('sums pops and net output', () =>
		expect(
			totals([
				row('A', { pops: 3, net: { energy: 5 } }),
				row('B', { pops: 4, net: { energy: -2, food: 1 } })
			])
		).toEqual({ pops: 7, net: { energy: 3, food: 1 } }));
});

describe('sortRows', () => {
	const rows = [
		row('b', { pops: 5, habitability: null }),
		row('a', { pops: 9, habitability: 0.5 }),
		row('c', { pops: 5, habitability: 1, net: { energy: 3 } })
	];
	const names = (rs: ColonyRow[]) => rs.map((r) => r.name);
	it('sorts numbers both ways, ties in their order', () => {
		expect(names(sortRows(rows, { column: 'pops', desc: false }))).toEqual(['b', 'c', 'a']);
		expect(names(sortRows(rows, { column: 'pops', desc: true }))).toEqual(['a', 'b', 'c']);
	});
	it('sorts text and puts unknown values last either way', () => {
		expect(names(sortRows(rows, { column: 'name', desc: false }))).toEqual(['a', 'b', 'c']);
		expect(names(sortRows(rows, { column: 'habitability', desc: true }))).toEqual(['c', 'a', 'b']);
		expect(names(sortRows(rows, { column: 'habitability', desc: false }))).toEqual(['a', 'c', 'b']);
	});
	it('sorts by a net resource', () =>
		expect(names(sortRows(rows, { column: 'net:energy', desc: true }))).toEqual(['c', 'b', 'a']));
});

describe('filterRows', () => {
	const suits = (resource: string) => ({
		pros: [],
		cons: [],
		suits: [{ resource, score: 5, why: [] }],
		mismatch: null
	});
	const rows = [
		row('Earth', { room: 2, profile: suits('minerals') }),
		row('Sirius', { sector: 'Cradle', blockers: 1, problems: ['stability 40 (below 50)'] })
	];
	const names = (f: Partial<typeof NO_FILTERS>) =>
		filterRows(rows, { ...NO_FILTERS, ...f }).map((r) => r.name);
	it('filters by each criterion', () => {
		expect(names({})).toEqual(['Earth', 'Sirius']);
		expect(names({ text: 'sir' })).toEqual(['Sirius']);
		expect(names({ sector: 'Earth' })).toEqual(['Earth']);
		expect(names({ suits: 'minerals' })).toEqual(['Earth']);
		expect(names({ attention: true })).toEqual(['Sirius']);
		expect(names({ freeDistricts: true })).toEqual(['Earth']);
		expect(names({ blockers: true })).toEqual(['Sirius']);
	});
});

describe('netResources / parseView', () => {
	it('lists the resources made or used, in top-bar order', () =>
		expect(
			netResources([row('a', { net: { food: 1, energy: 0, minerals: -2, nanites: 1 } })])
		).toEqual(['minerals', 'food', 'nanites']));
	it('defaults a missing or broken view and drops unknown columns', () => {
		expect(parseView(undefined)).toEqual(DEFAULT_VIEW);
		expect(parseView({ filters: { text: 3, sector: 'Earth' } }).filters).toEqual({
			...NO_FILTERS,
			sector: 'Earth'
		});
		expect(
			parseView({ mode: 'sector', columns: ['pops', 'gone'], filters: { blockers: true } })
		).toMatchObject({
			mode: 'sector',
			columns: ['pops'],
			filters: { ...NO_FILTERS, blockers: true }
		});
	});
});
