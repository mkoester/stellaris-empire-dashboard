import { describe, expect, it } from 'vitest';
import { colonySpecies, enslavedPops, slaveryKeys } from './colonySpecies.ts';
import type { GameData } from './types.ts';

const option = (key: string, name: string, isSlavery = false) => ({
	key,
	name,
	isSlavery,
	isPurge: false,
	potential: null,
	allow: null
});
const rights: GameData['speciesRights'] = [
	{
		kind: 'citizenship',
		options: [
			option('citizenship_full', 'Full Citizenship'),
			option('citizenship_slavery', 'Chattel Slavery', true)
		]
	},
	{ kind: 'slavery', options: [option('slavery_indentured', 'Indentured Servitude')] }
];
// Fangnaur 2200.08 (4.5.3): Cevelli citizens, Quenti slaves on the capital
const snap = {
	species: [
		{ id: '0', name: 'Cevelli', cls: 'AVI', traits: [], pops: 3138 },
		{ id: '2', name: 'Quenti', cls: 'MAM', traits: [], pops: 1600 }
	],
	speciesRights: {
		'0': { citizenship: 'citizenship_full', slavery: 'slavery_indentured' },
		'2': { citizenship: 'citizenship_slavery', slavery: 'slavery_indentured' }
	}
};
const colony = { speciesPops: { '0': 3138, '2': 1600, '5': 0 }, speciesHabitability: { '0': 0.8 } };

describe('colonySpecies', () => {
	it('lists species by pops with citizenship, the slavery type for slaves only', () => {
		expect(colonySpecies(colony, snap, rights)).toEqual([
			{
				id: '0',
				name: 'Cevelli',
				pops: 3138,
				citizenship: 'Full Citizenship',
				slavery: null,
				enslaved: false,
				habitability: 0.8
			},
			{
				id: '2',
				name: 'Quenti',
				pops: 1600,
				citizenship: 'Chattel Slavery',
				slavery: 'Indentured Servitude',
				enslaved: true,
				habitability: null
			}
		]);
	});
});

describe('enslavedPops', () => {
	it('sums the pops of enslaved species', () => {
		expect(enslavedPops(colony, snap, slaveryKeys(rights))).toBe(1600);
	});
	it('is unknown before the field or without rights', () => {
		expect(enslavedPops({ speciesPops: undefined as never }, snap, new Set())).toBeNull();
		expect(enslavedPops(colony, { speciesRights: null }, new Set())).toBeNull();
	});
});
