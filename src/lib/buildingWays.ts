import { ASCENSION_SITUATIONS } from './planner/kinds.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { GameData, Snapshot } from './types.ts';

// How an empire gets a building it cannot build yet: its `potential` (data DB
// `building.potential_json`, extractor 2026-11-27) read as ways — each alternative of an OR — and
// in each, what can still be gained: a country flag a situation stage sets (4.6 Augmentation
// Center: `augmentation_center_available`, Cyberization stage II), a tradition (also by a swap's
// own key: `tr_cybernetics_augmentation_centers`, Augmentation Overload's variant without The
// Machine Age), a tech, a perk. A way that also needs what the empire cannot change (a civic it
// lacks, a swap whose trigger fails) is left out. Pure.

export type WayData = Pick<
	GameData,
	'techs' | 'traditionTrees' | 'traditionSwaps' | 'perks' | 'situationTypes'
> &
	Partial<Pick<GameData, 'stageFlags'>>;

export type BuildingNeeds = {
	now: boolean | null; // the potential holds today
	ways: string[]; // what each way still needs, in the empire's words
	impossible: boolean; // no way is open to this empire
};

const ALWAYS: Trigger = { leaf: 'always', value: 'yes' };

/** Both conditions, either of them absent. */
const both = (a: Trigger | null | undefined, b: Trigger | null | undefined): Trigger | null =>
	a && b ? { op: 'and', args: [a, b] } : (a ?? b ?? null);

/**
 * A tradition key as triggers name it — the tradition itself, or a swap's own key — with what
 * taking it needs: its tree's `potential`, and a swap's trigger.
 */
function tradition(key: string, d: WayData) {
	const treeOf = (k: string) =>
		Object.values(d.traditionTrees).find((x) => x.traditions.some((t) => t.key === k));
	const tree = treeOf(key);
	if (tree)
		return {
			name: tree.traditions.find((t) => t.key === key)!.name,
			tree: tree.name,
			when: tree.potential ?? null
		};
	for (const [owner, swaps] of Object.entries(d.traditionSwaps))
		for (const s of swaps)
			if (s.key === key) {
				const t = treeOf(owner);
				return { name: s.name ?? key, tree: t?.name ?? null, when: both(s.trigger, t?.potential) };
			}
	return null;
}

/** What a leaf the empire can still gain reads as; null: not one of those. */
function gainable(
	t: Trigger,
	d: WayData,
	ours: string[] = []
): { text: string; when: Trigger | null } | null {
	if (!('leaf' in t) || t.cmp) return null;
	switch (t.leaf) {
		case 'has_country_flag': {
			const all = d.stageFlags?.[t.value];
			if (!all?.length) return null;
			// the empire's own situations, where it has one of them (the Cybernetic Creed's
			// Conclave of Fusion sets the Augmentation Center's flag too)
			const mine = all.filter((x) => ours.includes(x.situation));
			const from = mine.length ? mine : all;
			return {
				text: from
					.map((x) => `${d.situationTypes[x.situation]?.name ?? x.situation}, ${x.stage}`)
					.filter((x, i, all) => all.indexOf(x) === i)
					.join(' or '),
				when: null
			};
		}
		case 'has_tradition':
		case 'has_active_tradition': {
			const tr = tradition(t.value, d);
			return tr
				? { text: `the tradition ${tr.name}${tr.tree ? ` (${tr.tree})` : ''}`, when: tr.when }
				: null;
		}
		case 'has_technology':
			return { text: d.techs[t.value]?.name ?? t.value, when: null };
		case 'has_ascension_perk':
			return { text: d.perks[t.value] ?? t.value, when: null };
		default:
			return null;
	}
}

/** The gainable leaves of a way, in order. */
function gains(t: Trigger, d: WayData, f: Facts, ours: string[]): string[] {
	if ('leaf' in t) {
		const g = gainable(t, d, ours);
		return g && evaluate(t, f) !== true ? [g.text] : [];
	}
	return t.op === 'not' ? [] : t.args.flatMap((a) => gains(a, d, f, ours));
}

/** The way with what can be gained taken as given (a swap: its own trigger). */
function relaxed(t: Trigger, d: WayData): Trigger {
	if ('leaf' in t) {
		const g = gainable(t, d);
		return g ? (g.when ?? ALWAYS) : t;
	}
	return t.op === 'not' ? t : { ...t, args: t.args.map((a) => relaxed(a, d)) };
}

/**
 * Whether the empire may build it now, and if not, how it gets there. `ours`: the situations it
 * runs or ran, which pick a flag's source among several.
 */
export function buildingNeeds(
	potential: Trigger | null,
	d: WayData,
	f: Facts,
	ours: string[] = []
): BuildingNeeds {
	const now = evaluate(potential, f);
	if (potential === null || now === true) return { now, ways: [], impossible: false };
	const alternatives = 'op' in potential && potential.op === 'or' ? potential.args : [potential];
	const open = alternatives.filter((w) => evaluate(relaxed(w, d), f) !== false);
	return {
		now,
		ways: open
			.map((w) => gains(w, d, f, ours).join(' and '))
			.filter((x, i, all) => x && all.indexOf(x) === i),
		impossible: !open.length
	};
}

/**
 * The situations a building's flag may come from for this empire: those it runs or ran, and the
 * ascensions it can still start (`ASCENSION_SITUATIONS`, its tree or perk not ruled out). Never an
 * origin's own (the Cybernetic Creed's Conclave of Fusion), which starts with the game or not at all.
 */
export function ownSituations(
	s: Pick<Snapshot, 'situations'>,
	seen: string[],
	d: Pick<GameData, 'traditionTrees' | 'perks'>,
	f: Facts
): string[] {
	const startable = Object.entries(ASCENSION_SITUATIONS).flatMap(([starter, list]) => {
		const tree = Object.values(d.traditionTrees).find((t) =>
			t.traditions.some((x) => x.key === starter)
		);
		const open = tree
			? evaluate(tree.potential ?? null, f) !== false
			: Object.hasOwn(d.perks, starter);
		return open ? list : [];
	});
	return [...new Set([...(s.situations ?? []).map((x) => x.type), ...seen, ...startable])];
}
