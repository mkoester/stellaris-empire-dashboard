import { describe, expect, it } from 'vitest';
import { opposite, patronCards, standing } from './shroud.ts';
import type { GameData, PatronRelation, Shroud } from './types.ts';

const rel = (
	patron: string,
	x: number,
	y: number,
	r: Partial<PatronRelation> = {}
): PatronRelation => ({
	patron,
	x,
	y,
	contact: 'none',
	calling: null,
	deeds: [],
	...r
});

// the throwaway game at 2206.04.01: the Composer contacted, the Instrument across from it
const composer = rel('the_composer_of_strands', 0, -1, {
	contact: 'completed',
	calling: { key: 'calling_establish_colony', tier: 1, start: '2205.12.02', completed: false },
	deeds: ['deed_host_new_species', 'deed_pass_divinity_resolution']
});
const instrument = rel('the_instrument_of_desire', 0, 1, {
	deeds: ['deed_establish_trade_agreement', 'deed_pass_industry_resolution', 'deed_uplift_species']
});
const shroud: Shroud = {
	attunement: { x: -0.1175, y: -0.215 },
	monthStart: { x: -0.1475, y: -0.065 },
	lastDelve: '2205.10.01',
	preferred: 'the_instrument_of_desire',
	patrons: [composer, instrument, rel('the_hollow_point', 0.7, 0.7)]
};
const data: GameData['shroud'] = {
	patrons: {
		the_composer_of_strands: {
			name: 'Composer of Strands',
			category: 'major_patron',
			color: '#209b35',
			covenant: 'Covenant of the Composer',
			accords: [{ kind: 'passive', name: 'Growth' }]
		}
	},
	callings: { calling_establish_colony: { name: 'Calling of Flight', tiers: { 1: 100, 2: 200 } } },
	deeds: {
		deed_host_new_species: { name: 'Hosting', attunement: 15 },
		deed_pass_divinity_resolution: { name: 'Divining', attunement: 20 },
		deed_establish_trade_agreement: { name: 'Trading', attunement: 10 },
		deed_pass_industry_resolution: { name: 'Exploiting', attunement: 20 },
		deed_uplift_species: { name: 'Uplifting', attunement: 0.1 }
	}
};

describe('the Shroud', () => {
	it("reads a standing as the game's screen: month-start attunement towards the patron", () => {
		expect(standing(shroud.monthStart, composer)).toBe(65); // the screenshot, 2206.04
	});

	it('finds the patron across the circle', () => {
		expect(opposite(shroud.patrons, composer)).toBe(instrument);
		expect(opposite(shroud.patrons, rel('x', 0, 0))).toBeNull();
	});

	it('shows contacted patrons only, with the calling, its deeds and the opposite ones negative', () => {
		const [card, ...more] = patronCards(shroud, data);
		expect(more).toEqual([]);
		expect(card).toMatchObject({
			name: 'Composer of Strands',
			standing: 65,
			calling: { name: 'Calling of Flight', tier: 1, reward: 100, completed: false },
			covenant: 'Covenant of the Composer',
			preferred: false
		});
		expect(card.positive.map((d) => [d.name, d.weight])).toEqual([
			['Divining', 20],
			['Hosting', 15]
		]);
		expect(card.negative.map((d) => [d.name, d.weight])).toEqual([
			['Exploiting', -20],
			['Trading', -10],
			['Uplifting', -0.1]
		]);
	});
});
