import { describe, expect, it } from 'vitest';
import { rightRows } from './rights.ts';
import type { Facts } from './triggers.ts';
import type { GameData } from './types.ts';

const option = (key: string, flags: { isSlavery?: boolean; isPurge?: boolean } = {}) => ({
	key,
	name: key,
	isSlavery: false,
	isPurge: false,
	potential: null,
	allow: null,
	...flags
});
const kinds: GameData['speciesRights'] = [
	{
		kind: 'citizenship',
		options: [
			option('citizenship_full'),
			option('citizenship_slavery', { isSlavery: true }),
			option('citizenship_purge', { isPurge: true })
		]
	},
	{ kind: 'living_standard', options: [option('living_standard_good')] },
	{ kind: 'slavery', options: [option('slavery_normal'), option('slavery_indentured')] },
	{ kind: 'purge', options: [option('purge_normal'), option('purge_displacement')] }
];
const facts = { government: [], traditions: [] } as unknown as Facts;
// the save keeps a slavery and a purge type for every species, as United Nations of Earth 2201.01.01
const set = (citizenship: string) => ({
	citizenship,
	living_standard: 'living_standard_good',
	slavery: 'slavery_indentured',
	purge: 'purge_displacement'
});

describe('rightRows', () => {
	it('leaves the slavery and purge types out for full citizens', () => {
		expect(rightRows(kinds, set('citizenship_full'), facts).map((r) => r.kind)).toEqual([
			'citizenship',
			'living_standard'
		]);
	});

	it('shows the slavery type for slaves, the purge type for undesirables', () => {
		const kindsOf = (c: string) => rightRows(kinds, set(c), facts).map((r) => r.kind);
		expect(kindsOf('citizenship_slavery')).toContain('slavery');
		expect(kindsOf('citizenship_slavery')).not.toContain('purge');
		expect(kindsOf('citizenship_purge')).toContain('purge');
		expect(kindsOf('citizenship_purge')).not.toContain('slavery');
	});

	it('shows every kind with `all`', () => {
		expect(rightRows(kinds, set('citizenship_full'), facts, true)).toHaveLength(4);
	});
});
