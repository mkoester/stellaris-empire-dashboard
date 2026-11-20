import { describe, expect, it } from 'vitest';
import { inFirstRow, stripOrder } from './resourceGroups.ts';

describe('inFirstRow', () => {
	it('keeps basic, advanced and reserves above strategic, unity and influence', () => {
		expect(
			['energy', 'trade', 'operational_reserves', 'volatile_motes', 'unity', 'influence'].map(
				inFirstRow
			)
		).toEqual([true, true, true, false, false, false]);
	});
});

describe('stripOrder', () => {
	it("puts a nomad's Operational Reserves in energy's and minerals' place", () => {
		expect(stripOrder(['operational_reserves', 'food', 'volatile_motes'])).toEqual([
			'operational_reserves',
			'food',
			'consumer_goods',
			'alloys',
			'trade',
			'volatile_motes',
			'unity',
			'influence'
		]);
	});

	it('puts basic first, then motes, gases, crystals, the rest alphabetically, unity and influence last', () => {
		expect(
			stripOrder([
				'unity',
				'sr_zro',
				'rare_crystals',
				'energy',
				'exotic_gases',
				'volatile_motes',
				'sr_dark_matter',
				'society_research'
			])
		).toEqual([
			'energy',
			'minerals',
			'food',
			'consumer_goods',
			'alloys',
			'trade',
			'volatile_motes',
			'exotic_gases',
			'rare_crystals',
			'sr_dark_matter',
			'sr_zro',
			'unity',
			'influence'
		]);
	});
});
