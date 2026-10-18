import { describe, expect, it } from 'vitest';
import { contactTable, parseContactView, shown } from './contacts.ts';
import type { Relation } from './types.ts';

const rel = (countryId: number, r: Partial<Relation> = {}): Relation => ({
	countryId,
	name: `C${countryId}`,
	contact: true,
	communications: true,
	hostile: false,
	opinion: 0,
	trust: 0,
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
		const view = parseContactView({});
		expect(shown(rows, view).length).toBe(3);
		expect(shown(rows, { ...view, communicationsOnly: true }).map((r) => r.countryId)).toEqual([
			20, 16
		]);
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
