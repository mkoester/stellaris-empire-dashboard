import { describe, expect, it } from 'vitest';
import { focusView } from './focus.ts';
import type { Facts } from './triggers.ts';

const diplomatic = { leaf: 'is_diplomatic', value: 'no' };
const data = {
	categories: { development: 'Development', conquest: 'Conquest' },
	cards: {
		conquest_focus_120: {
			category: 'conquest',
			tier: 1,
			name: 'Declare a Rival',
			hint: null,
			requirement: 'Has declared a Rival',
			gives: [{ category: 'conquest', amount: 10 }]
		}
	},
	rewards: {
		development_rewards_2: {
			category: 'development',
			cost: 60,
			options: [{ tech: 'tech_adaptive_bureaucracy', when: null }]
		},
		// 00_development_focus_rewards.txt: Colonial Centralization if not diplomatic, else Federation Code
		development_rewards_3: {
			category: 'development',
			cost: 80,
			options: [
				{ tech: 'tech_colonial_centralization', when: diplomatic },
				{ tech: 'tech_federation_code', when: { op: 'not' as const, args: [diplomatic] } }
			]
		}
	}
};
// our 2207.03.10 empire: diplomatic (not homicidal, no Inward Perfection)
const facts: Facts = {
	countryType: 'default',
	government: ['auth_democratic'],
	origin: 'origin_default',
	governmentType: null,
	dlcs: null,
	policyFlags: [],
	countryFlags: [],
	traditions: [],
	perks: [],
	techs: [],
	atWar: false,
	situations: 0,
	nomadic: false
};

describe('focusView', () => {
	it('names the cards and shows each reward with the one after it, and which option is ours', () => {
		const v = focusView(
			{
				priority: 'development',
				cards: [{ key: 'conquest_focus_120', done: false }],
				rewards: [{ category: 'development', current: 'development_rewards_2', progress: 40 }]
			},
			data,
			facts
		);
		expect(v.cards[0]).toMatchObject({ name: 'Declare a Rival', done: false });
		expect(v.rewards[0]).toMatchObject({ name: 'Development', priority: true, progress: 40 });
		expect(v.rewards[0].now?.cost).toBe(60);
		expect(v.rewards[0].next?.options.map((o) => [o.tech, o.ours])).toEqual([
			['tech_colonial_centralization', false],
			['tech_federation_code', true]
		]);
	});
});
