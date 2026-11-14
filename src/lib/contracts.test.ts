import { describe, expect, it } from 'vitest';
import {
	contractLine,
	contractRows,
	contractSystems,
	inRange,
	kindOf,
	parseContractView,
	type ContractContext
} from './contracts.ts';
import type { Contract } from './types.ts';

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
		contract_colony_startup: {
			name: 'Colony Startup',
			category: 'diplomacy_contract',
			timeToAccept: 1800
		},
		contract_raid_planet_small: {
			name: 'Raid Planet',
			category: 'military_contract',
			timeToAccept: 1800
		},
		contract_eternal_chorus: {
			name: 'Eternal Chorus',
			category: 'science_contract_internal',
			timeToAccept: null
		}
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
