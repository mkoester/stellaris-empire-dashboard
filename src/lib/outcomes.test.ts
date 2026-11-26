import { describe, expect, it } from 'vitest';
import {
	branchLabels,
	displayList,
	effectText,
	effectRef,
	fromTable,
	ifHead,
	monthsParts,
	nowTable,
	holds,
	isChoice,
	markers,
	prune,
	resolve,
	outcomeText,
	rewardBadges,
	rewards,
	segments,
	techFlags,
	techMarkFlags,
	withProjects,
	withSpecimens,
	type Now,
	type OutcomeNode,
	type TechMark
} from './outcomes.ts';
import type { Facts, Trigger } from './triggers.ts';

// Shaped like the 4.5 extraction's trees: Gravity Assist Studies (one tech progress), A Cold
// Discovery (ICY_FLOWERS_CAT: a choice, one option starting BOTANICAL_GARDEN_PROJECT, 50/50).
const gravity: OutcomeNode[] = [
	{
		t: 'event',
		id: 'extreme_frontiers.445',
		title: 'Orbital Slingshot Advancements',
		e: [],
		o: [
			{
				name: 'Excellent!',
				cond: false,
				e: [{ t: 'tech', k: 'tech_orbital_maneuvers', name: 'Advanced Orbital Maneuvers', p: 0.25 }]
			}
		]
	}
];
const months = (n: number, min: number): OutcomeNode => ({
	t: 'months',
	r: 'society_research',
	n,
	min,
	max: 100000
});
const garden: OutcomeNode[] = [
	{
		t: 'random',
		b: [
			{ w: 50, cond: false, e: [{ t: 'xp', n: 200 }, months(18, 350)] },
			{ w: 50, cond: false, e: [{ t: 'xp', n: 50 }, months(12, 250)] }
		]
	}
];
const icy: OutcomeNode[] = [
	{
		t: 'event',
		id: 'anomaly.2010',
		title: 'Botanical Paradise',
		e: [{ t: 'clear_deposits' }],
		o: [
			{
				name: 'There is more to explore here.',
				cond: false,
				e: [{ t: 'project', k: 'BOTANICAL_GARDEN_PROJECT', name: 'Explore The Botanical Paradise' }]
			},
			{ name: 'Abandon the project.', cond: false, e: [months(12, 250)] }
		]
	}
];

describe('markers', () => {
	it('one fixed outcome is known', () => {
		expect(markers(gravity)).toEqual(['fixed']);
	});

	it('a choice leading to a random project', () => {
		const tree = withProjects(icy, { BOTANICAL_GARDEN_PROJECT: garden });
		expect(markers(tree)).toEqual(['random', 'choice', 'project']);
		// without the project's tree the chance stays hidden
		expect(markers(icy)).toEqual(['choice', 'project']);
	});

	it('conditions, delays and risks', () => {
		const tree: OutcomeNode[] = [
			{ t: 'if', b: [[{ t: 'xp', n: 100 }], []], else: true },
			{ t: 'later', days: 36090, e: [{ t: 'kill_leader' }] }
		];
		expect(markers(tree)).toEqual(['depends', 'later', 'risk']);
		expect(markers([{ t: 'fleet', mine: false }])).toEqual(['fixed', 'risk']);
		expect(markers([{ t: 'res', r: 'energy', n: -100 }])).toEqual(['fixed', 'risk']);
	});
});

describe('isChoice', () => {
	const o = (cond: boolean) => ({ name: null, cond, e: [] });
	it('counts conditional options as one variant', () => {
		// The Orb: study (standard), eat (Devouring Swarm), leave it
		expect(isChoice([o(true), o(true), o(false)])).toBe(true);
		expect(isChoice([o(true), o(true)])).toBe(false);
		expect(isChoice([o(false)])).toBe(false);
	});
});

describe('withProjects', () => {
	it('stops at a project seen higher up', () => {
		const loop: OutcomeNode[] = [{ t: 'project', k: 'A', name: null }];
		const [a] = withProjects(loop, { A: loop });
		expect(a.t === 'project' && a.sub?.[0].t === 'project' && a.sub[0].sub).toBeUndefined();
	});
});

describe('text', () => {
	it('effects', () => {
		expect(effectText(months(12, 250))).toBe('12 months of society research income (min 250)');
		expect(effectText({ t: 'months', r: 'minerals', n: 18, min: 250, max: 5000 })).toBe(
			'18 months of minerals income (min 250, max 5,000)'
		);
		expect(effectText({ t: 'modifier', k: 'flagellating_movement', name: null, days: -1 })).toBe(
			'modifier flagellating movement (permanent)'
		);
		expect(effectText({ t: 'clear_deposits' })).toBe('the planet’s deposits removed');
		const egg = { t: 'specimen', k: 'giant_egg_shell', name: 'Giant Egg Shell' } as const;
		expect(effectRef(egg)).toBe('specimen:giant_egg_shell');
		const [withCat] = withSpecimens([egg], { giant_egg_shell: 'xeno_geology' });
		expect(effectText(withCat)).toBe('specimen Giant Egg Shell (xeno geology)');
	});

	it('paints resources and every L-Gate', () => {
		expect(
			segments('12 months of society research income', [
				{ word: 'society research', color: '#0f0' }
			])
		).toEqual([{ s: '12 months of ' }, { s: 'society research', color: '#0f0' }, { s: ' income' }]);
		expect(segments('L-Gate Insights, L-Gate')).toEqual([
			{ s: 'L-Gate', lgate: true },
			{ s: ' Insights, ' },
			{ s: 'L-Gate', lgate: true }
		]);
	});

	it('what months of income and tech progress come to now', () => {
		const now = {
			income: { society_research: 40 },
			tech: (k: string) => (k === 'tech_x' ? { cost: 1200, area: 'physics', perMonth: 100 } : null)
		};
		// 12 × 40 = 480 is above the min; the bounds come apart, for the frontier to grey
		expect(monthsParts(months(12, 250) as never, now)).toEqual({
			main: '12 months of society research income',
			now: ' ≈ +480 now',
			bounds: ' (min 250)'
		});
		expect(effectText(months(5, 250), now)).toBe(
			'5 months of society research income ≈ +250 now (min 250)'
		);
		// 25 % of 1200 = 300 physics, 3 months of our 100 a month
		const tech: OutcomeNode = { t: 'tech', k: 'tech_x', name: 'X', p: 0.25 };
		expect(effectText(tech, now)).toBe('+25 % X ≈ 300 physics, 3 months of ours');
		expect(effectText({ ...tech, k: 'tech_y' }, now)).toBe('+25 % X');
		expect(effectText(tech)).toBe('+25 % X');
	});

	it('a page gets the techs as a table', () => {
		const tech: OutcomeNode = { t: 'tech', k: 'tech_x', name: 'X', p: 0.5 };
		const t = nowTable(
			{ income: null, tech: () => ({ cost: 100, area: 'society', perMonth: null }) },
			[[{ t: 'random', b: [{ w: 1, cond: false, e: [tech] }] } as OutcomeNode]]
		);
		expect(t.techs).toEqual({ tech_x: { cost: 100, area: 'society', perMonth: null } });
		expect(effectText(tech, fromTable(t))).toBe('+50 % X ≈ 50 society');
	});

	it('percentages, or weights where a branch has conditions', () => {
		expect(
			branchLabels([
				{ w: 1, cond: false, e: [] },
				{ w: 3, cond: false, e: [] }
			])
		).toEqual(['25 %', '75 %']);
		// the Mineral Cluster: 0 plus 1 for a scientist without the trait, beside a plain 1
		expect(
			branchLabels([
				{ w: 0, cond: true, w_if: 1, e: [] },
				{ w: 1, cond: false, e: [] },
				{ w: 0, cond: true, e: [] }
			])
		).toEqual(['weight 1 if conditions hold, else 0', 'weight 1', 'if conditions hold']);
	});

	it('folds a research option into its progress, drops shared side events', () => {
		const list: OutcomeNode[] = [
			{ t: 'option', k: 'tech_x', name: 'X' },
			{ t: 'tech', k: 'tech_x', name: 'X', p: 0.1 },
			{ t: 'ref', id: 'story.5', title: 'Contact Report', shared: true }
		];
		expect(displayList(list)).toEqual([list[1]]);
	});

	it('rewards and tooltip text', () => {
		const tree = withProjects(icy, { BOTANICAL_GARDEN_PROJECT: garden });
		expect(rewards(tree).map((r) => r.text)).toContain('+200 leader experience');
		expect(rewards([{ t: 'trait', k: 'leader_trait_x', name: 'X' }])[0].ref).toBe(
			'ltrait:leader_trait_x'
		);
		expect(outcomeText(tree).split('\n')).toEqual([
			'random · choice · project',
			'Botanical Paradise',
			'  the planet’s deposits removed',
			'  ▸ “There is more to explore here.”',
			'    → special project Explore The Botanical Paradise',
			'      50 %:',
			'        +200 leader experience',
			'        18 months of society research income (min 350)',
			'      50 %:',
			'        +50 leader experience',
			'        12 months of society research income (min 250)',
			'  ▸ “Abandon the project.”',
			'    12 months of society research income (min 250)'
		]);
	});

	it('marks the next dig-site chapter', () => {
		const site: OutcomeNode[] = [
			{ t: 'chapter', n: 1, difficulty: 2, e: [{ t: 'res', r: 'minor_artifacts', n: 50 }] },
			{ t: 'chapter', n: 2, difficulty: 3, e: [] }
		];
		expect(outcomeText(site, 2)).toBe(
			'known\nChapter 1 (difficulty 2)\n  +50 minor artifacts\nChapter 2 (difficulty 3) ← next'
		);
	});
});

// The Intemporal Orb's options (4.5 extraction, with conditions): "Eat the orb." is a Devouring
// Swarm's alone; an `if` on a xenophile; a branch weighted by a flag the chain may set.
const us: Facts = {
	countryType: 'default',
	government: ['auth_democratic', 'ethic_xenophile', 'civic_idealistic_foundation'],
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
const swarm: Trigger = { leaf: 'has_valid_civic', value: 'civic_hive_devouring_swarm' };
const orb: OutcomeNode[] = [
	{
		t: 'event',
		id: 'anomaly.7105',
		title: 'The Orb',
		e: [],
		o: [
			{
				name: 'Study the orb.',
				cond: true,
				c: { op: 'not', args: [swarm] },
				e: [{ t: 'xp', n: 1 }]
			},
			{ name: 'Eat the orb.', cond: true, c: swarm, e: [{ t: 'res', r: 'food', n: 500 }] }
		]
	},
	{
		t: 'if',
		b: [[{ t: 'res', r: 'unity', n: 10 }], [{ t: 'res', r: 'energy', n: 10 }]],
		else: true,
		c: [{ leaf: 'has_ethic', value: 'ethic_xenophile' }, null]
	},
	{
		t: 'random',
		b: [
			{
				w: 0,
				cond: true,
				w_if: 1,
				c: { leaf: 'has_country_flag', value: 'x' },
				e: [{ t: 'res', r: 'alloys', n: 1 }]
			},
			{ w: 1, cond: false, e: [{ t: 'res', r: 'minerals', n: 1 }] }
		]
	}
];

describe('holds', () => {
	it('a flag the chain may still set is unknown while absent, an ethic is not', () => {
		expect(holds({ leaf: 'has_country_flag', value: 'x' }, us)).toBe(null);
		expect(holds({ leaf: 'has_ethic', value: 'ethic_xenophobe' }, us)).toBe(false);
		expect(holds({ op: 'not', args: [swarm] }, us)).toBe(true);
	});
});

describe('resolve and prune', () => {
	const r = resolve(orb, us);
	it('marks what this empire cannot take, with why, and drops the conditions', () => {
		const ev = r[0] as Extract<OutcomeNode, { t: 'event' }>;
		expect(ev.o.map((o) => !!o.off)).toEqual([false, true]);
		expect(ev.o[1].why).toContain('devouring swarm');
		expect(JSON.stringify(r)).not.toContain('"c":');
		expect((r[1] as Extract<OutcomeNode, { t: 'if' }>).taken).toEqual([true, false]);
	});
	it('an unknown condition leaves the branch as it was', () => {
		expect((r[2] as Extract<OutcomeNode, { t: 'random' }>).b[0].cond).toBe(true);
	});
	it('prune keeps what is left: one option, the taken if branch in place', () => {
		const p = prune(r);
		expect((p[0] as Extract<OutcomeNode, { t: 'event' }>).o.map((o) => o.name)).toEqual([
			'Study the orb.'
		]);
		expect(p[1]).toEqual({ t: 'res', r: 'unity', n: 10 });
		expect(markers(p)).not.toContain('choice');
	});
	it('a settled weight of 0 turns its branch off', () => {
		const known = resolve(
			[
				{
					t: 'random',
					b: [{ w: 0, cond: true, w_if: 1, c: { leaf: 'has_ethic', value: 'e' }, e: [] }]
				}
			],
			us
		);
		expect((known[0] as Extract<OutcomeNode, { t: 'random' }>).b[0].off).toBe(true);
	});
	it('names each if branch by its condition: ours, foreign or none', () => {
		const flag = { leaf: 'has_country_flag', value: 'x' };
		const deposit = { leaf: 'has_deposit_for', value: 'shipclass_research_station' };
		const tree: OutcomeNode[] = [
			{
				t: 'if',
				b: [[{ t: 'xp', n: 1 }], [{ t: 'xp', n: 2 }], [{ t: 'xp', n: 3 }]],
				else: true,
				c: [flag, null, null],
				d: [flag, deposit, null]
			}
		];
		const n = resolve(tree, us)[0] as Extract<OutcomeNode, { t: 'if' }>;
		expect(ifHead(n, 0)).toMatchObject({ label: 'if country flag x:', note: ' (not now)' });
		expect(ifHead(n, 1).note).toBe(' (not your empire’s)');
		expect(ifHead(n, 1).label).toContain('deposit for');
		expect(ifHead(n, 2).label).toBe('otherwise:');
		expect(ifHead(resolve(orb, us)[1] as typeof n, 0).label).toBe('for your empire:');
		const bare: typeof n = { t: 'if', b: [[{ t: 'xp', n: 1 }]], else: false };
		expect(ifHead(bare, 0).label).toBe('depending on the planet, ship or empire:');
	});
	it('without conditions (an older data DB) nothing changes', () => {
		expect(prune(resolve(gravity, us))).toEqual(gravity);
	});
});

describe('tech standing', () => {
	const mark = (m: Partial<TechMark>): TechMark => ({
		area: 'physics',
		researched: false,
		permanent: false,
		plan: null,
		...m
	});
	const labels = (m: Partial<TechMark>, kind: 'option' | 'progress' | 'grant') =>
		techMarkFlags(mark(m), kind).map((f) => f.label);

	it('researched outranks everything else', () => {
		expect(
			labels({ researched: true, permanent: true, plan: { stance: 'want', note: '' } }, 'option')
		).toEqual(['researched']);
	});

	it('a permanent option makes another one useless, but not progress', () => {
		expect(labels({ permanent: true }, 'option')).toEqual(['already an option']);
		expect(labels({ permanent: true }, 'progress')).toEqual(['permanent option']);
	});

	it('says how it meets the plan', () => {
		expect(labels({ plan: { stance: 'want', note: '' } }, 'option')).toEqual(['planned']);
		expect(
			labels({ plan: { stance: 'want', note: 'needed for Mega-Engineering' } }, 'progress')
		).toEqual(['helps your plan']);
		expect(labels({ plan: { stance: 'later', note: '' } }, 'grant')).toEqual(['planned later']);
		expect(labels({ plan: { stance: 'avoid', note: '' } }, 'option')).toEqual(['avoided']);
		expect(labels({}, 'option')).toEqual([]);
	});

	it('reaches a page through the table, and the tooltip text', () => {
		const opt: OutcomeNode = { t: 'option', k: 'tech_x', name: 'X' };
		const t = nowTable(
			{ income: null, mark: (k) => (k === 'tech_x' ? mark({ permanent: true }) : null) },
			[[opt]]
		);
		const now = fromTable(t);
		expect(techFlags(opt, now).map((f) => f.label)).toEqual(['already an option']);
		expect(techFlags(opt)).toEqual([]);
		expect(outcomeText([opt], null, now).split('\n')[1]).toBe(
			'X as research option [already an option]'
		);
	});
});

describe('rewardBadges', () => {
	const now: Now = {
		income: null,
		mark: (k) => ({
			area: k === 'tech_e' ? 'engineering' : null,
			researched: false,
			permanent: false,
			plan: null
		})
	};
	const labels = (tree: OutcomeNode[]) => rewardBadges(tree, now).map((b) => b.label);

	it('research by field first, then options, resources and the rest', () => {
		expect(
			labels([
				{ t: 'res', r: 'minerals', n: 100 },
				{ t: 'tech', k: 'tech_e', name: 'E', p: 0.2 },
				months(6, 50),
				{ t: 'option', k: 'tech_o', name: 'O' },
				{ t: 'fleet', mine: true },
				{ t: 'xp', n: 100 },
				{ t: 'trait', k: 'leader_trait_a', name: 'Spark of Genius' },
				{ t: 'relic', k: 'r_x', name: null }
			])
		).toEqual([
			'society',
			'engineering',
			'research option',
			'minerals',
			'fleet',
			'leader xp',
			'trait Spark of Genius',
			'relic'
		]);
	});

	it('leaves out losses and fleets that are not ours; counts several traits', () => {
		expect(
			labels([
				{ t: 'res', r: 'energy', n: -50 },
				{ t: 'fleet', mine: false },
				{ t: 'trait', k: 'a', name: 'A' },
				{ t: 'trait', k: 'b', name: 'B' }
			])
		).toEqual(['2 traits']);
	});

	it('a leader behind a choice is offered, otherwise granted', () => {
		const ev = (o: OutcomeNode[][]): OutcomeNode => ({
			t: 'event',
			id: 'e.1',
			title: null,
			e: [],
			o: o.map((e, i) => ({ name: String(i), cond: false, e }))
		});
		expect(labels([ev([[{ t: 'leader' }], []])])).toEqual(['leader offered']);
		expect(labels([ev([[{ t: 'leader' }]])])).toEqual(['leader granted']);
		expect(labels([ev([[{ t: 'leader' }], []]), { t: 'leader' }])).toEqual(['leader granted']);
	});
});
