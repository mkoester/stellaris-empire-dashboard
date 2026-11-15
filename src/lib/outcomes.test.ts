import { describe, expect, it } from 'vitest';
import {
	branchLabels,
	displayList,
	effectText,
	isChoice,
	markers,
	outcomeText,
	rewards,
	withProjects,
	type OutcomeNode
} from './outcomes.ts';

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
			'flagellating movement (permanent)'
		);
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
		expect(rewards(tree)).toContain('+200 leader experience');
		expect(outcomeText(tree).split('\n')).toEqual([
			'random · choice · project',
			'Botanical Paradise',
			'  deposits cleared',
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
