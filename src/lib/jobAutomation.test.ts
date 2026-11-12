import { describe, expect, it } from 'vitest';
import {
	automationBarred,
	automationBuildingsOf,
	automationLines,
	automationOptions,
	automationStep,
	perEnergy,
	type JobAutomation
} from './jobAutomation.ts';

// 4.5.4: the data DB's building_modifier, building_resource, technology_unlock and
// pop_category_automation rows for the farmer line.
const mods = {
	building_automation_farmer_1: [
		{ key: 'job_farmer_automated_workforce_mult', value: 0.25 },
		{ key: 'job_agri_drone_automated_workforce_mult', value: 0.25 }
	],
	building_automation_farmer_2: [
		{ key: 'job_farmer_automated_workforce_mult', value: 0.5 },
		{ key: 'job_agri_drone_automated_workforce_mult', value: 0.5 }
	],
	// a farm that automates its farmers too: not an automation building
	building_nourishment_center: [
		{ key: 'job_farmer_automated_workforce_mult', value: 1 },
		{ key: 'planet_housing_add', value: 5 }
	]
};
const names = {
	building_automation_farmer_1: 'Automation Building: Farmer',
	building_automation_farmer_2: 'Optimization Building: Farmer'
};
const techs = {
	building_automation_farmer_1: ['tech_assembly_pattern'],
	building_automation_farmer_2: ['tech_construction_templates']
};
const data: JobAutomation = {
	buildings: automationBuildingsOf(mods, names, techs),
	rates: { worker: { energy: 4 }, simple_drone: { energy: 4 }, specialist: { energy: 8 } }
};
const costs = {
	building_automation_farmer_1: { cost: { minerals: 600 }, upkeep: { energy: 8 }, produces: {} },
	building_automation_farmer_2: { cost: { minerals: 800 }, upkeep: { energy: 10 }, produces: {} }
};
// a colony with four farming districts, fully worked: 800 farmer workforce making 48 food
const farmers = {
	type: 'farmer',
	category: 'worker',
	filled: 800,
	positions: 800,
	flows: { food: 48 }
};

describe('automationBuildingsOf', () => {
	it('takes buildings whose every modifier automates a job', () => {
		expect(data.buildings.map((b) => b.key)).toEqual([
			'building_automation_farmer_1',
			'building_automation_farmer_2'
		]);
		expect(data.buildings[0].jobs).toEqual({ farmer: 0.25, agri_drone: 0.25 });
	});

	it('lines them up by their jobs, lowest share first', () => {
		const lines = automationLines([...data.buildings].reverse());
		expect(lines.map((l) => l.map((b) => b.key))).toEqual([
			['building_automation_farmer_1', 'building_automation_farmer_2']
		]);
	});
});

describe('automationStep', () => {
	it('frees what pops work on a fully worked job', () => {
		expect(automationStep(farmers, 0.25, data.rates)).toEqual({
			job: 'farmer',
			name: 'farmer',
			automated: 200,
			added: 200,
			freed: 200,
			filled: 0,
			output: {},
			upkeep: { energy: 8 } // 2 automated jobs × 4: 2 a district
		});
	});

	it('fills open positions first, at the job’s output per workforce', () => {
		const s = automationStep({ ...farmers, filled: 600, flows: { food: 36 } }, 0.25, data.rates);
		expect(s).toMatchObject({ added: 200, freed: 0, filled: 200, output: { food: 12 } });
	});

	it('adds to what is automated and stops at the positions', () => {
		const s = automationStep({ ...farmers, automated: 600 }, 0.5, data.rates);
		expect(s).toMatchObject({ automated: 800, added: 200, freed: 200 });
		expect(automationStep({ ...farmers, automated: 800 }, 0.25, data.rates)).toBeNull();
		expect(automationStep({ ...farmers, positions: null }, 0.25, data.rates)).toBeNull();
	});
});

describe('automationOptions', () => {
	it('offers the first building where none stands', () => {
		const [o] = automationOptions([farmers], [], ['tech_assembly_pattern'], costs, data);
		expect(o).toMatchObject({
			key: 'building_automation_farmer_1',
			replaces: null,
			freed: 200,
			cost: { minerals: 600 },
			upkeep: { energy: 16 }, // the building's 8 + 2 automated jobs × 4
			missing: []
		});
		expect(perEnergy(o)).toBe(200 / 16);
	});

	it('offers the upgrade for the share it adds, with the upkeep difference', () => {
		const held = { ...farmers, automated: 200 };
		const [o] = automationOptions([held], ['building_automation_farmer_1'], [], costs, data);
		expect(o).toMatchObject({
			key: 'building_automation_farmer_2',
			replaces: 'building_automation_farmer_1',
			freed: 200,
			cost: { minerals: 800 },
			upkeep: { energy: 10 }, // 10 − 8, + 2 jobs × 4
			missing: ['tech_construction_templates']
		});
	});

	it('offers nothing past the last step or without the jobs', () => {
		const top = ['building_automation_farmer_1', 'building_automation_farmer_2'];
		expect(automationOptions([farmers], top, [], costs, data)).toEqual([]);
		expect(automationOptions([{ ...farmers, type: 'miner' }], [], [], costs, data)).toEqual([]);
	});

	it('cannot tell the techs without the unlock table', () => {
		const bare = { ...data, buildings: automationBuildingsOf(mods, names, {}) };
		expect(automationOptions([farmers], [], [], costs, bare)[0].missing).toBeNull();
	});
});

describe('automationBarred', () => {
	it('names Tankbound and wilderness empires', () => {
		expect(automationBarred(['civic_tankbound_corporate'], 'origin_default')).toBe('tankbound');
		expect(automationBarred([], 'origin_wilderness')).toBe('wilderness');
		expect(automationBarred(null, null)).toBeNull();
	});
});
