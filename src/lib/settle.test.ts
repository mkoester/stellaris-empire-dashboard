import { describe, expect, it } from 'vitest';
import {
	allMet,
	embarkRequirements,
	settleOutcome,
	settleRequirements,
	settleTargets
} from './settle.ts';
import type { ExpansionRow } from './expansion.ts';
import type { GalaxySystem } from './types.ts';
import type { Arkship, Colony, Snapshot } from './types.ts';

const trees = {
	tradition_adaptability: {
		name: 'Adaptability',
		traditions: ['adopt', 'recycling', 'finish'].map((t) => ({ key: `tr_adaptability_${t}` }))
	},
	tradition_versatility: {
		name: 'Versatility',
		traditions: ['adopt', 'finish'].map((t) => ({ key: `tr_versatility_${t}` }))
	}
};
const base = {
	traditions: ['tr_adaptability_adopt'],
	government: ['civic_nomadic_crew', 'auth_democratic'],
	origin: 'origin_nomads',
	countryFlags: [],
	subjects: []
} as Pick<Snapshot, 'traditions' | 'government' | 'origin' | 'countryFlags' | 'subjects'>;

describe('settleRequirements', () => {
	it('wants Adaptability finished, Versatility for a machine intelligence', () => {
		const rs = settleRequirements(base, trees);
		expect(rs.map((r) => [r.key, r.met, r.detail])).toEqual([
			['tradition', false, '1 of 3 taken'],
			['independent', true, '']
		]);
		expect(
			settleRequirements({ ...base, traditions: ['tr_adaptability_finish'] }, trees)[0].met
		).toBe(true);
		const machine = settleRequirements(
			{ ...base, government: ['auth_machine_intelligence'], traditions: ['tr_versatility_finish'] },
			trees
		);
		expect([machine[0].label, machine[0].met]).toEqual(['Versatility finished', true]);
	});
	it('never for the Sacred Path; Forever Cruise after planetfall, no tradition', () => {
		const sacred = settleRequirements({ ...base, origin: 'origin_sacred_path' }, trees);
		expect(sacred).toMatchObject([{ met: false, never: true }]);
		const cruise = (flags: string[]) =>
			allMet(
				settleRequirements({ ...base, origin: 'origin_forever_cruise', countryFlags: flags }, trees)
			);
		expect(cruise([])).toBe(false);
		expect(cruise(['forever_cruise_planetfall'])).toBe(true);
	});
	it('the Knights: the Toxic God, or the tradition once their keep is gone', () => {
		const knights = (flags: string[], traditions = base.traditions) =>
			allMet(
				settleRequirements(
					{ ...base, origin: 'origin_toxic_knights', countryFlags: flags, traditions },
					trees
				)
			);
		expect(knights([])).toBe(false);
		expect(knights(['visited_toxic_god_system'])).toBe(true);
		expect(knights(['toxic_knights_destroyed_keep'])).toBe(false);
		expect(knights(['toxic_knights_destroyed_keep'], ['tr_adaptability_finish'])).toBe(true);
	});
	it('not as a subject; unknown where the save cannot tell', () => {
		const subject = { weAreOverlord: false, name: 'Overlord' } as NonNullable<
			Snapshot['subjects']
		>[number];
		const rs = settleRequirements({ ...base, subjects: [subject] }, trees);
		expect(rs[1]).toMatchObject({ met: false, detail: 'subject of Overlord' });
		expect(allMet(settleRequirements({ ...base, traditions: null }, trees))).toBeNull();
		expect(
			allMet(
				settleRequirements(
					{ ...base, traditions: ['tr_adaptability_finish'], subjects: null },
					trees
				)
			)
		).toBeNull();
	});
});

describe('embarkRequirements', () => {
	const settled = {
		...base,
		origin: 'origin_default',
		traditions: ['tr_adaptability_finish'],
		ascensionPerks: [],
		situations: [],
		colonies: [] as Colony[]
	};
	it('is open with the tree finished and nothing ruling it out', () => {
		expect(allMet(embarkRequirements(settled, trees))).toBe(true);
	});
	it('rules out origins, homicidal civics and Cosmogenesis for good', () => {
		const names = { origin_shroud_forged: 'Shroud-Forged' };
		const forged = embarkRequirements({ ...settled, origin: 'origin_shroud_forged' }, trees, names);
		expect(forged.find((r) => r.key === 'origin')).toMatchObject({
			met: false,
			never: true,
			detail: 'Shroud-Forged never embarks'
		});
		const purifiers = embarkRequirements(
			{ ...settled, government: ['civic_fanatic_purifiers'] },
			trees
		);
		expect(purifiers.find((r) => r.key === 'identity')).toMatchObject({ met: false, never: true });
		const cosmo = embarkRequirements({ ...settled, ascensionPerks: ['ap_cosmogenesis'] }, trees);
		expect(allMet(cosmo)).toBe(false);
	});
	it('waits for a colony being settled and a running Red Giant Expansion', () => {
		const colonizing = embarkRequirements(
			{ ...settled, colonies: [{ name: 'Mars', colonizing: true } as Colony] },
			trees
		);
		expect(colonizing.find((r) => r.key === 'colonizing')).toMatchObject({
			met: false,
			detail: 'Mars'
		});
		const giant = embarkRequirements(
			{ ...settled, situations: [{ type: 'situation_red_giant_expansion' } as never] },
			trees
		);
		expect(giant.find((r) => r.key === 'situation')?.met).toBe(false);
	});
	it('takes the Doomsday flag for the tree', () => {
		const rs = embarkRequirements(
			{ ...settled, traditions: [], countryFlags: ['doomsday_embark_unlocked'] },
			trees
		);
		expect(rs[0].met).toBe(true);
	});
});

describe('settleOutcome', () => {
	const ark = (shipId: number, tier: number, capital = false): Arkship => ({
		shipId,
		colonyId: shipId + 10,
		name: `Ark ${shipId}`,
		size: `civilian_arkship_tier_${tier}`,
		tier,
		planetSize: 9,
		systemId: 1,
		capital
	});
	const colony = (planetId: number, pops: number) => ({ planetId, pops }) as Colony;
	it('scuttles the arkships besides the capital, counts waystations and logistic ships', () => {
		const o = settleOutcome({
			arkships: [ark(0, 1, true), ark(4, 2), ark(5, 3)],
			colonies: [colony(-1, 5000), colony(-5, 800), colony(-6, 20)],
			stations: [{ level: 'waystation_1' }, { level: 'military_arkship_1' }] as never,
			civilianShips: [{ size: 'nomads_constructor' }, { size: 'science' }] as never,
			government: ['auth_democratic'],
			origin: 'origin_nomads'
		});
		expect(o).toEqual({
			arkships: 3,
			others: [
				{ name: 'Ark 4', pops: 800, refund: 1500 },
				{ name: 'Ark 5', pops: 20, refund: 2000 }
			],
			waystations: 1,
			logistic: 1,
			subjectOptions: true,
			why: ''
		});
	});
	it('releases no subject when homicidal or a gestalt but a Progenitor Hive', () => {
		const o = (government: string[], origin = 'origin_nomads') =>
			settleOutcome({
				arkships: [],
				colonies: [],
				stations: [],
				civilianShips: [],
				government,
				origin
			});
		expect(o(['civic_fanatic_purifiers'])).toMatchObject({
			subjectOptions: false,
			why: 'homicidal'
		});
		expect(o(['auth_hive_mind']).subjectOptions).toBe(false);
		expect(o(['auth_hive_mind'], 'origin_progenitor_hive').subjectOptions).toBe(true);
	});
});

describe('settleTargets', () => {
	const row = (planetId: number, name: string, hab: number, size: number, extra = {}) =>
		({
			planetId,
			name,
			className: 'Continental',
			climate: 'wet',
			size,
			system: 'S',
			colonizable: true,
			hab: { '1': hab },
			planet: { deposits: [], modifiers: [] },
			...extra
		}) as unknown as ExpansionRow;
	const system = (id: number, lanes: number[], bodies: { id: number; deposits?: string[] }[]) =>
		({
			id,
			lanes,
			bodies: bodies.map((b) => ({ deposits: [], ...b }))
		}) as unknown as GalaxySystem;
	const galaxy = [
		system(1, [2], [{ id: 10 }, { id: 11, deposits: ['d_minerals_2', 'd_energy_1'] }]),
		system(2, [3], [{ id: 20 }]),
		system(3, [], [{ id: 30 }])
	];
	it('ranks by habitability once settled, then size; jumps from arkships and the capital', () => {
		const rows = [
			row(10, 'Near', 0, 15),
			row(20, 'Mid', 0.2, 10),
			row(30, 'Far', 0.2, 20),
			row(31, 'Rock', 1, 30, { colonizable: false }),
			row(32, 'Holy', 1, 30, {
				planet: { deposits: [], modifiers: [{ key: 'consecrated_world', until: null }] }
			})
		];
		const t = settleTargets(
			rows,
			galaxy,
			[
				{ systemId: 3, capital: true },
				{ systemId: 1, capital: false }
			],
			'1'
		);
		expect(t.map((x) => [x.name, x.settled, x.fromArk, x.fromCapital, x.deposits])).toEqual([
			['Far', 0.8, 0, 0, 0],
			['Mid', 0.8, 1, 1, 0],
			['Near', 0.6, 0, 2, 2]
		]);
	});
});
