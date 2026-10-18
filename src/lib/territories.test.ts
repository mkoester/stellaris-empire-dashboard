import { describe, expect, it } from 'vitest';
import { guessGroups, mergeSightings, shipsetName, territories } from './territories.ts';
import type { CountryInfo, GalaxySystem, Relation } from './types.ts';

const sys = (id: number, s: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x: id * 20,
	y: 0,
	star: 'sc_g',
	lanes: [id + 1], // a chain 1–2–3–…
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	...s
});
const country = (id: number, flagColor: string, shipset: string): CountryInfo => ({
	id,
	name: `C${id}`,
	type: 'default',
	shipset,
	flagColor,
	ethics: [],
	authority: null,
	civics: [],
	governmentType: null,
	origin: null
});
const relation = (countryId: number, communications: boolean): Relation => ({
	countryId,
	name: `C${countryId}`,
	contact: true,
	communications,
	hostile: false,
	opinion: null,
	trust: 0,
	threat: 0,
	borderRange: null
});

describe('guessGroups', () => {
	it('takes one shipset close together for one empire, far apart for two', () => {
		const galaxy = Array.from({ length: 12 }, (_, i) => sys(i + 1));
		const seen = [1, 3, 11].map((systemId) => ({ systemId, shipset: 'avian_01' }));
		expect(guessGroups(seen, galaxy)).toEqual([
			{ shipset: 'avian_01', systems: [1, 3] },
			{ shipset: 'avian_01', systems: [11] }
		]);
	});
});

describe('territories', () => {
	const base = {
		ownId: 0,
		ownName: 'Us',
		countries: [country(0, 'blue', 'humanoid_01'), country(7, 'red', 'avian_01')],
		flagColors: { blue: '#2e3f99', red: '#970e12' },
		spoiler: false
	};
	const galaxy = [sys(1, { owned: true, ownerId: 0 }), sys(2, { ownerId: 7 }), sys(3)];
	const seen = [
		{ systemId: 2, ownerId: 7, shipset: 'avian_01', first: '2207.01.01', last: '2207.01.01' }
	];

	it('names an empire we talk to, in its flag colour', () => {
		const t = territories({ ...base, galaxy, relations: [relation(7, true)], seen });
		expect(t.map((x) => [x.label, x.color, x.guess, x.systems])).toEqual([
			['Us', '#2e3f99', false, [1]],
			['C7', '#970e12', false, [2]]
		]);
	});

	it('only guesses one we saw but cannot talk to, without its name or colour', () => {
		const t = territories({ ...base, galaxy, relations: [relation(7, false)], seen });
		expect(t[1].label).toBe('unknown empire (guess: Avian shipset)');
		expect(t[1].guess).toBe(true);
		expect(t[1].color).not.toBe('#970e12');
		expect(JSON.stringify(t)).not.toContain('C7');
	});

	it('shows a visited station we did not see as unknown', () => {
		const t = territories({ ...base, galaxy, relations: [], seen: [] });
		expect(t.at(-1)).toMatchObject({ key: 'unknown', systems: [2] });
	});
});

describe('sectors', () => {
	it('splits our own territory by sector, in the colonies tab’s colours', () => {
		const galaxy = [
			sys(1, { owned: true, ownerId: 0, sector: 'Earth' }),
			sys(2, { owned: true, ownerId: 0, sector: 'Cradle' }),
			sys(3, { owned: true, ownerId: 0, sector: null })
		];
		const [own] = territories({
			ownId: 0,
			ownName: 'Us',
			countries: [],
			relations: [],
			seen: [],
			flagColors: {},
			spoiler: false,
			galaxy,
			sectorColors: { Earth: '#111111', Cradle: '#222222' }
		});
		expect(own.parts?.map((t) => [t.label, t.color, t.systems])).toEqual([
			['Earth', '#111111', [1]],
			['Cradle', '#222222', [2]],
			['(no sector)', '#8a8984', [3]]
		]);
	});
});

describe('mergeSightings', () => {
	it('keeps the first and the latest sighting per system', () => {
		const s = (date: string, shipset: string) => ({
			date,
			stationsSeen: [{ systemId: 4, ownerId: 7, shipset }]
		});
		expect(mergeSightings([s('2207.01.01', 'a'), s('2207.02.01', 'b')])).toEqual([
			{ systemId: 4, ownerId: 7, shipset: 'b', first: '2207.01.01', last: '2207.02.01' }
		]);
	});
	it('names shipsets', () => expect(shipsetName('mammalian_01')).toBe('Mammalian'));
});
