import { describe, expect, it } from 'vitest';
import { officeCost, officeValue, siteRows } from './branchOffices.ts';
import type { BranchSite, Relation } from './types.ts';

const site = (
	colonyId: number,
	ownerId: number,
	trade: number,
	jumps: number | null,
	office: string | null = null
): BranchSite => ({
	colonyId,
	name: `c${colonyId}`,
	systemId: null,
	ownerId,
	owner: `e${ownerId}`,
	trade,
	jumps,
	office
});
const rel = (countryId: number, agreements: string[]) => ({ countryId, agreements }) as Relation;

describe('office value and cost', () => {
	it('half the colony’s trade; 75 influence + 5 a jump, at most 1000', () => {
		expect(officeValue(112.24)).toBeCloseTo(56.12);
		expect(officeCost(0)).toBe(75);
		expect(officeCost(10)).toBe(125);
		expect(officeCost(500)).toBe(1000);
		expect(officeCost(null)).toBeNull();
	});
});

describe('siteRows', () => {
	const sites = [
		site(1, 7, 100, 10),
		site(2, 7, 100, 2),
		site(3, 9, 400, 2),
		site(4, 7, 50, 1, 'Rival Corp')
	];
	it('only what can open now: a commercial pact, no office yet; best per influence first', () => {
		expect(
			siteRows(sites, [rel(7, ['commercial_pact']), rel(9, ['embassy'])]).map((r) => r.colonyId)
		).toEqual([2, 1]);
	});
	it('everything with `all`', () => {
		const rows = siteRows(sites, [], true);
		expect(rows.map((r) => r.colonyId)).toEqual([3, 2, 1, 4]);
		expect(rows[0].perInfluence).toBeCloseTo((200 / 85) * 100);
	});
});
