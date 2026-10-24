import { describe, expect, it } from 'vitest';
import { stripOrder } from './resourceGroups.ts';

describe('stripOrder', () => {
	it('puts basic first, unity and influence last, the rest alphabetically between', () => {
		expect(
			stripOrder(['unity', 'rare_crystals', 'energy', 'exotic_gases', 'society_research'])
		).toEqual([
			'energy',
			'minerals',
			'food',
			'consumer_goods',
			'alloys',
			'trade',
			'exotic_gases',
			'rare_crystals',
			'unity',
			'influence'
		]);
	});
});
