import { describe, expect, it } from 'vitest';
import { proposable } from './proposable.ts';
import type { Facts, Trigger } from './triggers.ts';
import type { GalacticCommunity, GameData } from './types.ts';

const active = (value: string): Trigger => ({ leaf: 'is_active_resolution', value });
const resolution = (
	category: string,
	level: number | null,
	r: Partial<GameData['resolutions'][string]> = {}
) => ({
	category,
	level,
	target: false,
	cost: 100,
	repeal: false,
	potential: null,
	allow: null,
	validTarget: null,
	aiWeight: null,
	...r
});
// 4.5.2's Industry chain, two tiers and the repeal of the first, and the Galactic Market
const RESOLUTIONS: GameData['resolutions'] = {
	resolution_industry_regulatory_facilitation: resolution('industry', 1, {
		allow: { op: 'not', args: [active('resolution_industry_regulatory_facilitation')] }
	}),
	resolution_industry_collective_waste_management: resolution('industry', 2, {
		cost: 150,
		allow: active('resolution_industry_regulatory_facilitation')
	}),
	resolution_industry_repeal_1: resolution('industry', null, {
		repeal: true,
		potential: active('resolution_industry_regulatory_facilitation')
	}),
	resolution_galactic_market_form: resolution('market', null, {
		potential: {
			op: 'not',
			args: [{ leaf: 'has_global_flag', value: 'galactic_market_founded' }]
		}
	}),
	resolution_politics_special: resolution('politics', null, {
		potential: { leaf: 'has_tradition', value: 'tr_politics_finish' }
	}),
	resolution_council_thing: resolution('council', null, {
		allow: { leaf: 'num_council_positions', value: '3', cmp: '>' }
	}),
	// 4.5.2 Form Galactic Council: the Community must exist 10 years
	resolution_galacticreforms_form_council: resolution('galacticreforms', null, {
		allow: { leaf: 'is_years_since_community_formation', cmp: '>=', value: '10' }
	}),
	// 4.5.2: names the custodian — none before the council forms
	resolution_galacticreforms_unseat_custodian: resolution('galacticreforms', null, {
		target: true,
		validTarget: { leaf: 'is_galactic_custodian', value: 'yes' }
	}),
	resolution_repeal_crisis: resolution('declare_crisis', null, {
		target: true,
		validTarget: { leaf: 'has_country_flag', value: 'declared_crisis' }
	})
};
const vote = (id: number, type: string) => ({
	id,
	type,
	proposer: 'Cydran Concern',
	support: [],
	oppose: [],
	ours: null
});
const galcom = (g: Partial<GalacticCommunity> = {}): GalacticCommunity => ({
	formed: '2208.01.01',
	members: [],
	member: true,
	voting: null,
	proposed: [],
	passed: [],
	voteEnds: null,
	nextVote: null,
	weights: {},
	categoryTimers: {},
	globalFlags: [],
	...g
});
const facts = { traditions: [] } as unknown as Facts;
const status = (rows: ReturnType<typeof proposable>) =>
	Object.fromEntries(rows.map((r) => [r.key, r.status]));

describe('proposable', () => {
	it('offers the first tier, not the second, nor a repeal of what is not in force', () => {
		const rows = proposable(RESOLUTIONS, galcom(), facts, '2214.02.01', 0);
		expect(status(rows)).toEqual({
			resolution_industry_regulatory_facilitation: 'proposable',
			resolution_industry_collective_waste_management: 'locked',
			resolution_galactic_market_form: 'proposable',
			resolution_galacticreforms_form_council: 'cooldown',
			resolution_council_thing: 'unknown',
			resolution_galacticreforms_unseat_custodian: 'no target',
			resolution_repeal_crisis: 'needs a target'
		});
		expect(
			rows.find((r) => r.key === 'resolution_industry_collective_waste_management')?.needs
		).toBe('resolution_industry_regulatory_facilitation');
	});

	it('after a tier passed: in force, its repeal offered, the next on the category cooldown', () => {
		const rows = proposable(
			RESOLUTIONS,
			galcom({
				passed: [vote(9, 'resolution_industry_regulatory_facilitation')],
				categoryTimers: { industry: '2213.12.30' },
				globalFlags: ['galactic_market_founded']
			}),
			facts,
			'2214.02.01',
			-0.25
		);
		expect(status(rows)).toMatchObject({
			resolution_industry_regulatory_facilitation: 'in force',
			resolution_industry_collective_waste_management: 'cooldown',
			resolution_industry_repeal_1: 'cooldown'
		});
		expect(rows.map((r) => r.key)).not.toContain('resolution_galactic_market_form');
		const next = rows.find((r) => r.key === 'resolution_industry_collective_waste_management');
		// 2520 days after the vote, at 360-day years: 7 years
		expect(next).toMatchObject({ until: '2220.12.30', cost: 112.5 });
	});

	it('marks what is already proposed, and offers nothing to a non-member', () => {
		const queued = galcom({ proposed: [vote(12, 'resolution_galactic_market_form')] });
		expect(
			proposable(RESOLUTIONS, queued, facts, '2214.02.01', 0).find(
				(r) => r.key === 'resolution_galactic_market_form'
			)
		).toMatchObject({ status: 'proposed', by: 'Cydran Concern' });
		const outside = proposable(RESOLUTIONS, galcom({ member: false }), facts, '2214.02.01', 0);
		expect(new Set(outside.map((r) => r.status))).toEqual(new Set(['not a member']));
	});

	it('offers the Politics tradition’s resolutions once it is finished', () => {
		const done = { traditions: ['tr_politics_finish'] } as unknown as Facts;
		expect(
			status(proposable(RESOLUTIONS, galcom(), done, '2214.02.01', 0)).resolution_politics_special
		).toBe('proposable');
	});

	it('counts the years the Community must exist as a cooldown, and lifts it after them', () => {
		const council = (date: string) =>
			proposable(RESOLUTIONS, galcom(), facts, date, 0).find(
				(r) => r.key === 'resolution_galacticreforms_form_council'
			);
		expect(council('2214.02.01')).toMatchObject({ status: 'cooldown', until: '2218.01.01' });
		expect(council('2218.01.01')?.status).toBe('proposable');
	});
});
