import { describe, expect, it } from 'vitest';
import { graph } from './galaxyGraph.ts';
import {
	arkshipKind,
	branchLine,
	contractBonus,
	contractDetail,
	contractLine,
	contractRows,
	contractSystems,
	inRange,
	kindOf,
	parseContractView,
	type ContractContext,
	type DetailContext
} from './contracts.ts';
import type { Arkship, Contract, ContractType } from './types.ts';

// a contract type as an older data DB gives it: no details
const plain = (name: string, category: string, timeToAccept: number | null): ContractType => ({
	name,
	category,
	timeToAccept,
	detailed: false,
	timeToComplete: null,
	description: null,
	steps: null,
	reward: null,
	failedOpinion: null,
	operatorTechs: [],
	projects: []
});

const c = (o: Partial<Contract> & Pick<Contract, 'id'>): Contract => ({
	key: 'contract_colony_startup',
	issuer: 5,
	issuerName: 'Vel',
	operator: null,
	operatorName: null,
	systemId: 10,
	state: 'offered',
	daysLeft: 100,
	accepted: null,
	...o
});

// Shaped like Planetforgers 2214.02.01: we are 0 (settled) or the nomad 1.
const contracts = [
	c({ id: 1 }), // offered by 5, whom the nomad talks to, at system 10
	c({ id: 2, issuer: 6, systemId: 20 }), // offered by 6, unknown to the nomad
	c({ id: 3, issuer: 5, operator: 1, state: 'active', daysLeft: null, accepted: '2213.08.12' }),
	c({
		id: 4,
		issuer: 5,
		operator: 7,
		operatorName: 'Riggan',
		state: 'active',
		daysLeft: null,
		systemId: 30
	}),
	c({ id: 5, issuer: 0, systemId: 40, key: 'contract_raid_planet_small' }),
	c({
		id: 6,
		issuer: 1,
		issuerName: 'Korinth',
		operator: 1,
		operatorName: 'Korinth',
		key: 'contract_eternal_chorus',
		daysLeft: 50
	})
];

const ctx = (o: Partial<ContractContext>): ContractContext => ({
	me: 0,
	nomadic: false,
	talking: new Set([5]),
	jumps: new Map([
		[10, 1],
		[20, 4],
		[30, 0],
		[40, 0]
	]),
	range: 'mine',
	spoilers: false,
	all: false,
	types: {
		contract_colony_startup: plain('Colony Startup', 'diplomacy_contract', 1800),
		contract_raid_planet_small: plain('Raid Planet', 'military_contract', 1800),
		contract_eternal_chorus: plain('Eternal Chorus', 'science_contract_internal', null)
	},
	...o
});

const ids = (o: Partial<ContractContext>) =>
	contractRows(contracts, ctx(o)).map((r) => [r.id, r.why]);

describe('contractRows', () => {
	describe('nomad', () => {
		const n = { me: 1, nomadic: true };
		it('sees its own and the offers of issuers it talks to', () => {
			expect(ids(n)).toEqual([
				[6, 'mine'],
				[3, 'mine'],
				[1, 'offered']
			]);
		});
		it('spoiler: the offers of issuers it does not talk to', () => {
			expect(ids({ ...n, spoilers: true })).toEqual([
				[6, 'mine'],
				[3, 'mine'],
				[1, 'offered'],
				[2, 'spoiler'],
				[5, 'spoiler']
			]);
		});
		it('cheat: everything, other operators too', () => {
			expect(ids({ ...n, all: true }).map(([id]) => id)).toEqual([6, 3, 1, 2, 5, 4]);
		});
	});
	describe('settled', () => {
		it('sees the contracts it issued', () => {
			expect(ids({})).toEqual([[5, 'mine']]);
		});
		it('spoiler: others’ contracts within the range beyond the border', () => {
			expect(ids({ spoilers: true })).toEqual([
				[5, 'mine'],
				[4, 'spoiler']
			]);
			expect(ids({ spoilers: true, range: '1' }).map(([id]) => id)).toEqual([5, 6, 1, 3, 4]);
			expect(ids({ spoilers: true, range: 'all' })).toHaveLength(6);
		});
		it('cheat: everything', () => {
			expect(ids({ all: true })).toHaveLength(6);
		});
	});
	it('names, kinds and categories from the data DB; a mod’s contract by its key', () => {
		const rows = contractRows(
			[...contracts, c({ id: 7, issuer: 0, key: 'ahw_contract_repair_gate' })],
			ctx({})
		);
		expect(rows.map((r) => [r.name, r.kind, r.internal])).toEqual([
			['Raid Planet', 'military', false],
			['ahw_contract_repair_gate', 'other', false]
		]);
		const all = contractRows(contracts, ctx({ all: true }));
		expect(all.find((r) => r.id === 6)).toMatchObject({ kind: 'science', internal: true });
	});
});

describe('helpers', () => {
	it('kindOf', () => {
		expect(kindOf('crew_resource_contract_special')).toBe('resource');
		expect(kindOf('heirs_military_contract_special')).toBe('military');
		expect(kindOf('fleet')).toBe('other');
		expect(kindOf(null)).toBe('other');
	});
	it('inRange', () => {
		expect(inRange(0, 'mine')).toBe(true);
		expect(inRange(1, 'mine')).toBe(false);
		expect(inRange(3, '3')).toBe(true);
		expect(inRange(null, '10')).toBe(false);
		expect(inRange(null, 'all')).toBe(true);
	});
	it('parseContractView', () => {
		expect(parseContractView({ range: '4' })).toEqual({ range: '4' });
		expect(parseContractView({ range: 'x' })).toEqual({ range: 'mine' });
		expect(parseContractView(null)).toEqual({ range: 'mine' });
	});
	it('contractSystems groups by system', () => {
		const rows = contractRows(contracts, ctx({ all: true }));
		const at10 = contractSystems(rows).find((s) => s.systemId === 10);
		expect(at10?.rows.map((r) => r.id)).toEqual([6, 1, 3]); // all cheats here: by days left
		expect(at10?.kinds).toEqual(['science', 'diplomacy']);
	});
});

describe('contractLine', () => {
	const rows = contractRows(contracts, ctx({ me: 1, nomadic: true, all: true }));
	const line = (id: number) => contractLine(rows.find((r) => r.id === id)!);
	it('says who issued and who took it, and why it shows', () => {
		expect(line(1)).toBe('diplomacy contract by Vel');
		expect(line(4)).toBe('diplomacy contract by Vel, taken by Riggan · cheat');
		expect(line(6)).toBe('internal science contract of Korinth');
	});
});

// Colony Startup as the data DB of 2026-11-18 has it (4.5.x 02_contracts.txt)
const STARTUP: ContractType = {
	...plain('Colony Startup', 'diplomacy_contract', 1800),
	detailed: true,
	description: 'Help {issuer} get this colony in {system} running.',
	steps: 1,
	reward: {
		scaled: [{ trade: 750, resource: 'society_research', amount: 150 }],
		cruise: null,
		fixed: { influence: 50 },
		trust: 5,
		opinion: 50
	},
	failedOpinion: -125,
	operatorTechs: ['tech_x'],
	projects: [
		{
			key: 'CONTRACT_COLONY_STARTUP_PROJECT',
			name: 'Colony Startup',
			days: 180,
			requirements: { carries_colony: 1 },
			arkshipBranches: true
		}
	]
};

const ark = (o: Partial<Arkship>): Arkship => ({
	shipId: 0,
	colonyId: 0,
	name: 'Selborne',
	size: 'military_arkship_tier_1',
	tier: 1,
	planetSize: 9,
	systemId: 1,
	capital: true,
	...o
});

describe('contractDetail', () => {
	// lanes 1-2-3-10, and 4 off on its own
	const lanes = graph(
		[
			[1, 2],
			[2, 3],
			[3, 10]
		],
		[]
	);
	const row = contractRows([c({ id: 1 })], ctx({ me: 1, nomadic: true }))[0];
	const dctx = (o: Partial<DetailContext> = {}): DetailContext => ({
		completed: 0,
		researched: new Set(),
		arkships: [
			ark({}),
			ark({ name: 'Arden', size: 'science_arkship_tier_2', systemId: 3, capital: false }),
			ark({ name: 'Lost', systemId: 4, capital: false })
		],
		lanes,
		values: { society_research: 1, influence: 1, trade: 1 },
		systemName: 'Ulmar',
		techName: (k) => `T:${k}`,
		...o
	});

	it('says what to do, what it pays and which arkship is nearest', () => {
		const d = contractDetail(row, STARTUP, dctx());
		expect(d.description).toBe('Help Vel get this colony in Ulmar running.');
		expect(d.reward).toEqual([
			{ resource: 'trade', amount: 750, scaled: true },
			{ resource: 'society_research', amount: 150, scaled: true },
			{ resource: 'influence', amount: 50, scaled: false }
		]);
		expect(d.trade).toBe(950);
		expect(d.projects[0].needs).toEqual(['an arkship']);
		expect(d.needsArkship).toBe(true);
		expect(d.arkshipBranches).toBe(true);
		expect(d.missingTechs).toEqual(['T:tech_x']);
		expect(d.arkships.map((a) => [a.name, a.kind, a.jumps])).toEqual([
			['Arden', 'science', 1],
			['Selborne', 'military', 3],
			['Lost', 'military', null]
		]);
	});

	it('scales the trade and resource by completed contracts, not the fixed influence', () => {
		const d = contractDetail(row, STARTUP, dctx({ completed: 5, researched: new Set(['tech_x']) }));
		expect(d.bonus).toBe(1.5);
		expect(d.reward.map((l) => l.amount)).toEqual([1125, 225, 50]);
		expect(d.missingTechs).toEqual([]);
	});

	it('an older data DB: no details, the arkships still placed', () => {
		const d = contractDetail(row, plain('Colony Startup', 'diplomacy_contract', 1800), dctx());
		expect(d.detailed).toBe(false);
		expect(d.reward).toEqual([]);
		expect(d.trade).toBeNull();
		expect(d.arkships[0].jumps).toBe(1);
	});

	it('a second scaled reward is the partial success', () => {
		const raid: ContractType = {
			...STARTUP,
			reward: {
				scaled: [
					{ trade: 12500, resource: 'alloys', amount: 2500 },
					{ trade: 8250, resource: 'alloys', amount: 1650 }
				],
				cruise: null,
				fixed: {},
				trust: 15,
				opinion: 150
			}
		};
		const d = contractDetail(row, raid, dctx());
		expect(d.partial.map((l) => l.amount)).toEqual([8250, 1650]);
	});
});

describe('branchLine', () => {
	it('names what the nearest arkship gives the issuer, and that our reward does not change', () => {
		expect(branchLine([{ name: 'Selborne', kind: 'military', capital: true, jumps: 3 }])).toBe(
			"The issuer's colony gets a bonus by the type of arkship that does it — your reward is the same. Selborne (military): +1 alloys per colonist job."
		);
		expect(branchLine([])).not.toContain('(');
	});
});

describe('contractBonus / arkshipKind', () => {
	it('+10 % per contract completed, 1 to 50', () => {
		expect(contractBonus(null)).toBe(1);
		expect(contractBonus(0)).toBe(1);
		expect(contractBonus(12)).toBeCloseTo(2.2);
		expect(contractBonus(1000)).toBe(50);
	});
	it('the type from the size', () => {
		expect(arkshipKind('military_arkship_champions_forge')).toBe('military');
		expect(arkshipKind('science_arkship_tier_3')).toBe('science');
		expect(arkshipKind('civilian_arkship_tier_1')).toBe('civilian');
	});
});
