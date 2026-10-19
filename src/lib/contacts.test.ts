import { describe, expect, it } from 'vitest';
import { agreementName, combatLog, contactTable, parseContactView, shown } from './contacts.ts';
import type { Relation } from './types.ts';

const rel = (countryId: number, r: Partial<Relation> = {}): Relation => ({
	countryId,
	name: `C${countryId}`,
	contact: true,
	communications: true,
	hostile: false,
	opinion: 0,
	trust: 0,
	agreements: [],
	threat: 0,
	borderRange: null,
	...r
});

describe('contacts', () => {
	// 2207.03.10: the Imps (no communications yet), the hostile cloud, a caravaneer fleet
	const rows = contactTable(
		[rel(16777220, { communications: false }), rel(20, { hostile: true }), rel(16)],
		[
			{
				id: 16,
				name: 'Caravaneer Fleet1',
				type: 'caravaneer_fleet',
				shipset: null,
				ethics: [],
				authority: null,
				civics: [],
				governmentType: null,
				origin: null
			}
		],
		[]
	);

	it('filters by communications, hostility and country type', () => {
		const view = { ...parseContactView({}), communicationsOnly: false };
		expect(shown(rows, view).length).toBe(3);
		// the default
		expect(shown(rows, parseContactView({})).map((r) => r.countryId)).toEqual([20, 16]);
		expect(shown(rows, { ...view, hostile: 'hostile' }).map((r) => r.countryId)).toEqual([20]);
		expect(
			shown(rows, { ...view, hiddenTypes: ['caravaneer_fleet'] }).map((r) => r.countryId)
		).toEqual([16777220, 20]);
	});

	it('repairs a stored view', () => {
		expect(parseContactView({ hostile: 'x', columns: ['opinion', 'nope'] })).toMatchObject({
			hostile: 'any',
			columns: ['opinion']
		});
	});
});

describe('agreementName', () => {
	it("names the game's pacts and shows unknown flags by their key", () => {
		expect(agreementName('non_aggression_pledge')).toBe('non-aggression pact');
		expect(agreementName('migration_treaty')).toBe('migration treaty');
	});
});

describe('combatLog', () => {
	const combat = (fleetId: number, date: string, enemyLost: number) => ({
		fleetId,
		fleet: `F${fleetId}`,
		date,
		enemy: 'E',
		enemyFleets: 'EF',
		ships: 10,
		lost: 0,
		enemyShips: 3,
		enemyLost
	});

	it('keeps every combat a save caught, the latest reading of each, newest first', () => {
		const log = combatLog([
			{ combats: [combat(3, '2205.10.14', 2)] },
			{ combats: null },
			{ combats: [combat(3, '2205.10.14', 3), combat(4, '2205.11.20', 1)] },
			{ combats: [] }
		]);
		expect(log.map((c) => [c.fleetId, c.date, c.enemyLost])).toEqual([
			[4, '2205.11.20', 1],
			[3, '2205.10.14', 3]
		]);
	});
});
