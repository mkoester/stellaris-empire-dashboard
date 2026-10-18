import { describe, expect, it } from 'vitest';
import { focusView } from './focus.ts';

const data = {
	categories: { development: 'Development', conquest: 'Conquest' },
	cards: {
		conquest_focus_120: {
			category: 'conquest',
			tier: 1,
			name: 'Declare a Rival',
			hint: null,
			requirement: 'Has declared a Rival'
		}
	},
	rewards: {
		development_rewards_2: {
			category: 'development',
			cost: 60,
			techs: ['tech_adaptive_bureaucracy']
		},
		development_rewards_3: {
			category: 'development',
			cost: 80,
			techs: ['tech_colonial_centralization', 'tech_federation_code']
		}
	}
};

describe('focusView', () => {
	it('names the cards and shows each reward with the one after it', () => {
		// country.focus at 2207.03.10 (development picked, 40 of 60 towards its second reward)
		const v = focusView(
			{
				priority: 'development',
				cards: [{ key: 'conquest_focus_120', done: false }],
				rewards: [{ category: 'development', current: 'development_rewards_2', progress: 40 }]
			},
			data
		);
		expect(v.cards[0]).toMatchObject({ name: 'Declare a Rival', done: false });
		expect(v.rewards[0]).toMatchObject({
			name: 'Development',
			priority: true,
			progress: 40,
			cost: 60,
			techs: ['tech_adaptive_bureaucracy'],
			next: { cost: 80, techs: ['tech_colonial_centralization', 'tech_federation_code'] }
		});
	});
});
