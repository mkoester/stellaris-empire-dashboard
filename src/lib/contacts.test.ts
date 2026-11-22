import { describe, expect, it } from 'vitest';
import {
	agreementName,
	combatLog,
	contactTable,
	pageLatest,
	kindOf,
	parseContactView,
	proposalDates,
	proposedLabel,
	shown,
	voteStanding,
	empireTags,
	splinterOf,
	changeMark,
	contactChanges
} from './contacts.ts';
import type { CountryInfo, FirstContact, Relation } from './types.ts';

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

	it('tells nothing of what a contact is before communications', () => {
		const fauna = {
			id: 30,
			name: 'Cutholoids',
			type: 'cutholoids',
			shipset: null,
			flagColor: 'green',
			ethics: [],
			authority: null,
			civics: [],
			governmentType: null,
			origin: null
		};
		const [quiet] = contactTable([rel(30, { communications: false })], [fauna], []);
		expect(quiet.country).toBeNull();
		expect(quiet.flagColor).toBe('green');
		// shown whatever kinds are picked: its kind is not known yet
		const view = { ...parseContactView({}), communicationsOnly: false };
		expect(shown([quiet], view).length).toBe(1);
		const [talking] = contactTable([rel(30, { communications: true })], [fauna], []);
		expect(talking.country?.name).toBe('Cutholoids');
		expect(shown([talking], view)).toEqual([]);
	});

	it('keeps only ourselves and those we talk to for the page', () => {
		const c = (id: number) => ({
			id,
			name: `c${id}`,
			type: 'default',
			shipset: null,
			ethics: [],
			authority: null,
			civics: [],
			governmentType: null,
			origin: null
		});
		const s = {
			countryId: 1,
			countries: [c(1), c(2), c(3)],
			relations: [rel(2, { communications: true }), rel(3, { communications: false })]
		};
		expect(pageLatest(s).countries?.map((x) => x.id)).toEqual([1, 2]);
		// the galaxy's contracts name their issuers, met or not
		expect(pageLatest({ ...s, contracts: [{ issuerName: 'Yibrak' }] }).contracts).toBeNull();
		// storms' paths, a forecast without the tech
		expect(pageLatest({ ...s, storms: [{ path: [1073] }] }).storms).toBeNull();
		expect(pageLatest({ ...s, precursorIntel: { disabled: [] } }).precursorIntel).toBeNull();
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
		weights: {},
		categoryTimers: {},
		globalFlags: []
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

describe('proposedLabel', () => {
	it('names the month when the saves bracket one, else the range', () => {
		expect(proposedLabel({ after: '2208.10.01', by: '2208.11.01' })).toBe('2208.10');
		expect(proposedLabel({ after: '2208.12.01', by: '2209.01.01' })).toBe('2208.12');
		expect(proposedLabel({ after: '2208.10.01', by: '2208.12.01' })).toBe(
			'2208.10.01 – 2208.12.01'
		);
		expect(proposedLabel({ after: '2208.10.14', by: '2208.11.01' })).toBe(
			'2208.10.14 – 2208.11.01'
		);
		expect(proposedLabel({ after: null, by: '2205.03.01' })).toBe('by 2205.03.01');
	});
});

describe('a fallen hive’s fragments', () => {
	it('are told apart by their government, whatever their names', () => {
		expect(splinterOf('gov_war_splinter')).toBe('War Splinter');
		expect(splinterOf('gov_growth_splinter')).toBe('Growth Splinter');
		expect(splinterOf('gov_control_splinter')).toBe('Control Splinter');
		expect(splinterOf('gov_custodian_matrix')).toBeNull();
		expect(splinterOf(null)).toBeNull();
	});

	it('are tagged by the name we know them by, only once we talk', () => {
		// the campaign at 2226.08.01: three fragments of the Myrran hive
		const country = (id: number, name: string, governmentType: string) =>
			({ id, name, governmentType }) as CountryInfo;
		const s = {
			countries: [
				country(33, 'Indomitable Myrran Aggression', 'gov_war_splinter'),
				country(34, 'Indomitable Myrran Aspiration', 'gov_growth_splinter'),
				country(16777247, 'Forgotten Myrran Authority', 'gov_control_splinter'),
				country(5, 'Misharan Pact', 'gov_military_junta')
			],
			relations: [33, 34, 5].map((countryId) => ({ countryId, communications: true }) as Relation)
		};
		expect(empireTags(s)).toEqual({
			'Indomitable Myrran Aggression': 'War Splinter',
			'Indomitable Myrran Aspiration': 'Growth Splinter'
		});
	});
});

describe('contactChanges', () => {
	const fc = (id: number, difficulty: number, clues: number, defense?: number) =>
		({ id, difficulty, clues, defense }) as FirstContact;

	it('compares the last two readings', () => {
		expect(
			contactChanges([
				{ firstContacts: [fc(1, 5, 2, 0), fc(2, 7, 0, 2)] },
				{ firstContacts: null }, // a month from the feed: no reading
				{ firstContacts: [fc(1, 7, 4, 0), fc(2, 7, 0, 2), fc(3, 3, 0, 0)] }
			])
		).toEqual({ 1: { difficulty: 2, clues: 2 }, 2: { difficulty: 0, clues: 0 } });
	});

	it("leaves the difficulty unknown against a reading without the country's part", () => {
		expect(
			contactChanges([{ firstContacts: [fc(1, 5, 2)] }, { firstContacts: [fc(1, 7, 3, 2)] }])
		).toEqual({ 1: { difficulty: null, clues: 1 } });
	});

	it('has nothing with one reading or none', () => {
		expect(contactChanges([{ firstContacts: [fc(1, 5, 2, 0)] }])).toEqual({});
		expect(contactChanges([])).toEqual({});
	});
});

describe('changeMark', () => {
	it('draws a rise, a fall, and nothing', () => {
		expect(changeMark(2)).toBe('▲2');
		expect(changeMark(-1)).toBe('▼1');
		expect(changeMark(0)).toBe('');
		expect(changeMark(null)).toBe('');
	});
});
