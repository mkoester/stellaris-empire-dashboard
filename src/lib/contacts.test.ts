import { describe, expect, it } from 'vitest';
import {
	agreementName,
	combatLog,
	contactTable,
	kindOf,
	parseContactView,
	proposalDates,
	shown,
	voteStanding
} from './contacts.ts';
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

	it('filters by communications, hostility and kind', () => {
		const view = {
			...parseContactView({}),
			communicationsOnly: false,
			kinds: parseContactView({ kinds: ['traders', 'other'] }).kinds
		};
		expect(shown(rows, view).length).toBe(3);
		// the default: other empires with communications only — neither the cloud nor the traders
		expect(shown(rows, parseContactView({})).map((r) => r.countryId)).toEqual([]);
		expect(shown(rows, { ...view, hostile: 'hostile' }).map((r) => r.countryId)).toEqual([20]);
		expect(shown(rows, { ...view, kinds: ['other'] }).map((r) => r.countryId)).toEqual([
			16777220, 20
		]);
	});

	it('sorts country types into kinds', () => {
		expect(kindOf('default')).toBe('empires');
		expect(kindOf('awakened_fallen_empire')).toBe('fallen');
		expect(kindOf('caravaneer_fleet')).toBe('traders');
		expect(kindOf('primitive')).toBe('preFtl');
		expect(kindOf('tiyanki_garrison')).toBe('fauna');
		expect(kindOf('guardian_sphere')).toBe('fauna');
		expect(kindOf('dormant_marauders')).toBe('marauders');
		expect(kindOf('mindwarden_enclave')).toBe('enclaves');
		expect(kindOf('global_event')).toBe('other');
		expect(kindOf('')).toBe('other');
	});

	it('repairs a stored view', () => {
		expect(parseContactView({ hostile: 'x', columns: ['opinion', 'nope'] })).toMatchObject({
			hostile: 'any',
			kinds: ['empires'],
			columns: ['opinion']
		});
		expect(parseContactView({ kinds: ['fauna', 'x'] }).kinds).toEqual(['fauna']);
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

describe('proposalDates', () => {
	const vote = (id: number, type: string) => ({
		id,
		type,
		proposer: 'A',
		support: [],
		oppose: [],
		ours: null
	});
	const galcom = (proposed: ReturnType<typeof vote>[]) => ({
		formed: '2202.01.01',
		members: [],
		member: true,
		voting: null,
		proposed,
		passed: [],
		voteEnds: null,
		nextVote: null,
		weights: {}
	});

	it('dates a proposal between the last save without it and the first with it', () => {
		const dates = proposalDates([
			{ date: '2210.01.01', galcom: null },
			{ date: '2211.01.01', galcom: galcom([vote(3, 'r_a')]) },
			{ date: '2211.02.01', galcom: null }, // the mod's monthly line: no Galactic Community read
			{ date: '2211.03.01', galcom: galcom([vote(3, 'r_a'), vote(4, 'r_b')]) }
		]);
		expect(dates).toEqual({
			'3:r_a': { after: null, by: '2211.01.01' },
			'4:r_b': { after: '2211.01.01', by: '2211.03.01' }
		});
	});
});

describe('voteStanding', () => {
	it('is ahead when our side outweighs the other, else behind', () => {
		expect(voteStanding('for', 3000, 2000)).toBe('ahead');
		expect(voteStanding('against', 2000, 3000)).toBe('ahead');
		expect(voteStanding('for', 2000, 3000)).toBe('behind');
		expect(voteStanding('against', 3000, 2000)).toBe('behind');
		expect(voteStanding('for', 2000, 2000)).toBe('behind');
		expect(voteStanding(null, 3000, 2000)).toBeNull();
	});
});
