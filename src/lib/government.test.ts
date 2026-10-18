import { describe, expect, it } from 'vitest';
import {
	agendaRows,
	atLevel,
	edictRows,
	factionRows,
	facts,
	policyRows,
	possibleSeats,
	seatRows
} from './government.ts';
import { upgrade } from './upgrade.ts';
import type { GameData, Snapshot } from './types.ts';

const snap = upgrade({
	kind: 'save',
	campaign: 'c',
	date: '2207.03.10',
	countryType: 'default',
	government: ['ethic_fanatic_egalitarian', 'ethic_xenophile', 'auth_democratic'],
	origin: 'origin_default',
	policyFlags: ['unrestricted_wars'],
	traditions: ['tr_expansion_adopt'],
	agendasDone: ['agenda_done'],
	edictTimes: [{ key: 'map_the_stars', start: '2202.10.10', end: null }],
	policies: { diplomatic_stance: 'diplo_stance_expansionist' },
	progress: {
		research: [],
		researched: [],
		agenda: { key: 'agenda_unlock_slot', progress: 3719.5 },
		traditionsTaken: 5,
		nextElection: null,
		costSettings: { technology: 1, traditions: 1 }
	}
} as Partial<Snapshot> & Pick<Snapshot, 'kind' | 'campaign' | 'date'>);
const f = facts(snap);
const fallen = { leaf: 'is_country_type', value: 'fallen_empire' };

describe('policyRows', () => {
	it('drops options this empire cannot have and keeps the selected one', () => {
		const rows = policyRows(
			[
				{
					key: 'diplomatic_stance',
					name: 'Diplomatic Stance',
					category: 'diplomacy',
					options: [
						{
							key: 'diplo_stance_expansionist',
							name: 'Expansionist',
							potential: null,
							valid: null
						},
						{
							key: 'diplo_stance_isolationist_fallen_empire',
							name: 'Dormant',
							potential: fallen,
							valid: null
						},
						{
							key: 'diplo_stance_belligerent',
							name: 'Belligerent',
							potential: null,
							valid: { leaf: 'num_rivals', cmp: '>', value: '0' }
						}
					]
				}
			] as GameData['policies'],
			snap.policies!,
			f
		);
		expect(rows[0].options).toEqual([
			{ key: 'diplo_stance_expansionist', name: 'Expansionist', selected: true, valid: true },
			{ key: 'diplo_stance_belligerent', name: 'Belligerent', selected: false, valid: null }
		]);
	});
});

describe('agendaRows', () => {
	it('tells current, cooldown, open and locked agendas apart', () => {
		const rows = agendaRows(
			{
				agenda_unlock_slot: { name: 'Expand The Council', cost: 7000, unlockedBy: [] },
				agenda_done: { name: 'Done', cost: 1, unlockedBy: [] },
				agenda_free: { name: 'Free', cost: 1, unlockedBy: ['tr_expansion_adopt'] },
				agenda_locked: { name: 'Locked', cost: 1, unlockedBy: ['tr_unity_adopt'] }
			},
			snap,
			f
		);
		expect(rows.map((r) => r.status)).toEqual(['current', 'cooldown', 'open', 'locked']);
	});
});

describe('edictRows', () => {
	it('lists active edicts and those the empire could enact', () => {
		const edict = (potential: GameData['edicts'][string]['potential']) => ({
			name: 'x',
			category: 'edicts',
			length: -1,
			cost: {},
			potential,
			unlockedBy: []
		});
		const rows = edictRows(
			{ map_the_stars: edict(null), fe_only: edict(fallen), open: edict(null) },
			snap,
			f
		);
		expect(rows.map((r) => [r.key, r.active?.start ?? null])).toEqual([
			['map_the_stars', '2202.10.10'],
			['open', null]
		]);
	});
});

describe('factionRows', () => {
	it('puts our ethics first and reads each demand against the save', () => {
		const demand = (trigger: GameData['factionTypes'][number]['demands'][number]['trigger']) => ({
			title: 't',
			unfulfilledTitle: null,
			description: null,
			fulfilled: 5,
			unfulfilled: -5,
			potential: null,
			trigger
		});
		const rows = factionRows(
			[
				{
					key: 'imperialist',
					name: 'Imperialist',
					description: null,
					ethic: 'ethic_militarist',
					demands: []
				},
				{
					key: 'progressive',
					name: 'Progressive',
					description: null,
					ethic: 'ethic_egalitarian',
					demands: [
						demand({ leaf: 'has_policy_flag', value: 'unrestricted_wars' }),
						demand({ leaf: 'num_rivals', cmp: '>', value: '0' })
					]
				}
			],
			f
		);
		expect(rows.map((r) => [r.key, r.ours])).toEqual([
			['progressive', true],
			['imperialist', false]
		]);
		expect(rows[0].demands.map((d) => d.met)).toEqual([true, null]);
	});
});

describe('council seats', () => {
	const positions: GameData['councilPositions'] = {
		councilor_ruler_democratic: {
			name: 'Ruler',
			civic: null,
			classes: [],
			possible: { leaf: 'always', value: 'no' }
		},
		councilor_defense: {
			name: 'Minister of Defense',
			civic: null,
			classes: [],
			possible: { leaf: 'is_gestalt', value: 'no' }
		},
		councilor_gestalt_legion: {
			name: 'Legion Node',
			civic: null,
			classes: [],
			possible: { leaf: 'is_gestalt', value: 'yes' }
		},
		councilor_beacon_of_liberty: {
			name: 'Protector of Liberty',
			civic: 'civic_beacon_of_liberty',
			classes: [],
			possible: null
		},
		councilor_agrarian_idyll: {
			name: 'Elder Farmer',
			civic: 'civic_agrarian_idyll',
			classes: [],
			possible: null
		}
	};

	it('puts the ruler’s seat, by authority, before the seats held', () => {
		const rows = seatRows(
			[{ type: 'councilor_defense', leaderId: 1, leaderName: 'Eileen Graves', leaderLevel: 2 }],
			{ id: 9, name: 'Ruler', level: 3 },
			'auth_democratic',
			positions
		);
		expect(rows.map((r) => [r.key, r.level, r.ruler])).toEqual([
			['councilor_ruler_democratic', 3, true],
			['councilor_defense', 2, false]
		]);
	});

	it('scales the per-level modifiers', () => {
		const mod = { key: 'ships_upkeep_mult', value: -0.02, label: null, positiveIsGood: false };
		expect(atLevel([mod], 2)[0].value).toBeCloseTo(-0.04);
	});

	it('offers our civics’ seats and the base ones we can have', () => {
		const f2 = { ...f, government: [...f.government, 'civic_beacon_of_liberty'] };
		expect(possibleSeats(positions, ['councilor_defense'], f2).map((p) => p.key)).toEqual([
			'councilor_beacon_of_liberty'
		]);
	});
});
