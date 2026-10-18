import { describe, expect, it } from 'vitest';
import {
	capOf,
	DEFAULT_EXPANSION_VIEW,
	districtTypes,
	expansionCounts,
	parseExpansionView,
	sortRows,
	visible,
	type ExpansionRow
} from './expansion.ts';

const row = (
	name: string,
	colonizable: boolean,
	candidate: string | null,
	beyond: number | null = 0,
	more: Partial<ExpansionRow> = {}
) =>
	({
		name,
		colonizable,
		candidate,
		beyond,
		planetClass: 'pc_arid',
		hab: {},
		...more
	}) as ExpansionRow;
const view = (v: Partial<typeof DEFAULT_EXPANSION_VIEW>) => ({ ...DEFAULT_EXPANSION_VIEW, ...v });
// caps as districtCaps gives them: generator 9, 2 of it behind a blocker
const caps = (types: [string, number, number][], limit = 10, limitCleared = 12) =>
	({
		details: {
			blockers: [],
			caps: {
				limit,
				limitCleared,
				types: types.map(([district, cap, blocked]) => ({ district, cap, blocked }))
			}
		}
	}) as unknown as Partial<ExpansionRow>;

describe('expansion filter', () => {
	const rows = [
		row('Alpha Centauri II', true, null),
		row('Mars', false, 'terraforming_candidate'),
		row('Avishek III', false, 'toxic_terraforming_candidate'),
		row('Mercury', false, null)
	];
	const names = (v: { candidates: boolean; all: boolean }) =>
		rows.filter((p) => visible(p, view(v))).map((p) => p.name);

	it('shows colonizable classes by default, candidates and the rest behind toggles', () => {
		expect(names({ candidates: false, all: false })).toEqual(['Alpha Centauri II']);
		expect(names({ candidates: true, all: false })).toEqual([
			'Alpha Centauri II',
			'Mars',
			'Avishek III'
		]);
		expect(names({ candidates: false, all: true })).toHaveLength(4);
		expect(expansionCounts(rows)).toEqual({ candidates: 2, rest: 1 });
	});

	it('limits the distance beyond the borders', () => {
		const far = [
			row('Mars', true, null, 0),
			row('Xigar', true, null, 2),
			row('Lost', true, null, null)
		];
		const at = (beyond: number | null) =>
			far.filter((p) => visible(p, view({ beyond }))).map((p) => p.name);
		expect(at(0)).toEqual(['Mars']);
		expect(at(2)).toEqual(['Mars', 'Xigar']);
		expect(at(null)).toEqual(['Mars', 'Xigar', 'Lost']);
	});

	it('filters by class and by a district type allowed once blockers are cleared', () => {
		const rs = [
			row('Arid', true, null, 0, caps([['district_generator', 9, 2]])),
			row('Tundra', true, null, 0, {
				planetClass: 'pc_tundra',
				...caps([['district_mining', 5, 0]])
			})
		];
		const at = (v: Partial<typeof DEFAULT_EXPANSION_VIEW>) =>
			rs.filter((p) => visible(p, view(v))).map((p) => p.name);
		expect(at({ cls: 'pc_tundra' })).toEqual(['Tundra']);
		expect(at({ district: 'district_generator' })).toEqual(['Arid']);
		expect(capOf(rs[0], 'district_generator')).toEqual({ after: 9, now: 7 });
		expect(districtTypes(rs)).toEqual(['district_generator', 'district_mining']);
	});

	it('sorts by habitability for the species picked and by district caps', () => {
		const rs = [
			row('A', true, null, 0, { hab: { h: 0.3 }, ...caps([['district_mining', 3, 0]]) }),
			row('B', true, null, 0, { hab: { h: 0.9 }, ...caps([['district_mining', 8, 2]]) }),
			row('C', true, null, 0, { hab: {} })
		];
		const order = (column: string, desc: boolean) =>
			sortRows(rs, { column, desc }, 'h').map((p) => p.name);
		expect(order('hab', true)).toEqual(['B', 'A', 'C']);
		expect(order('cap:district_mining', false)).toEqual(['A', 'B', 'C']);
	});

	it('reads a stored view', () => {
		expect(parseExpansionView(undefined)).toEqual(DEFAULT_EXPANSION_VIEW);
		expect(parseExpansionView({ beyond: null, all: true, cls: 'pc_arid' })).toEqual(
			view({ beyond: null, all: true, cls: 'pc_arid' })
		);
		expect(parseExpansionView({ beyond: -1, cls: 3 })).toMatchObject({ beyond: 0, cls: '' });
	});
});
