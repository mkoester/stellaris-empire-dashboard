import { facts } from '#lib/government.ts';
import {
	candidates,
	KINDS as MEGA_KINDS,
	MEGA_RULES,
	type Kind as MegaKind
} from '#lib/megastructures.ts';
import {
	ARKSHIPS,
	arkships,
	areaOf,
	autoGoals,
	badgeOf,
	check,
	orderResearch,
	orderTraditions,
	GROUPS,
	groupOf,
	KINDS,
	label,
	STATION_LEVELS,
	traditionName,
	type LabelCtx,
	type PlanCtx,
	type State,
	unavailable
} from '#lib/planner/kinds.ts';
import {
	arrange,
	goalKey,
	leaves,
	otherBranches,
	parked,
	planAt,
	type Goal,
	type Plan,
	type PlanEvent,
	type Target
} from '#lib/planner/replay.ts';
import { holdsSince, seenAlong, type Since } from '#lib/planner/status.ts';
import { systemInfo } from '#lib/planner/systemInfo.ts';
import { techNeeds } from '#lib/planner/needs.ts';
import { AREAS, inReach } from '#lib/techTiers.ts';
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import { evaluate } from '#lib/triggers.ts';
import type { Explanation, Snapshot } from '#lib/types.ts';
import { WANDERLUST } from '#lib/wanderlust.ts';
import { getDb, getExplanations, getGameData } from './app.ts';
import { headId, history, nodes, planEvents } from './db.ts';
import { pick } from './explain.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { display } from './settings.ts';
import { colonyDetails } from './planets.ts';

// The planner tab's data (#lib/planner/*): the plan at the node shown, each goal checked against
// the branch's latest save, since when it holds, what could be planned next, what other branches
// planned, and the history of changes along the branch.

export type GoalRow = Omit<Goal, 'added'> & {
	group: string;
	label: string;
	ref: string | null;
	systemId: number | null;
	state: State;
	why: string | null;
	since: Since | null;
	manual: boolean;
	badge: string | null; // a tech's tier, a tradition's place in its tree, a perk
	area: string | null; // a tech's research area
	dependents: string[]; // the automatic goals only this one brings (removed with it, if wished)
	added: { nodeId: number; at: string; date: string | null };
};
export type Option = { value: string | number; label: string };
export type Suggestion = {
	kind: string;
	target: Target;
	label: string;
	why?: string;
	ref?: string | null; // a popup with its effects
	badge?: string | null;
	area?: string | null;
};
export type HistoryRow = {
	id: number;
	at: string;
	date: string | null; // the game date of the node it was made at
	op: string;
	goal: string;
	label: string;
	detail: string;
	kind: string | null; // what it is about, for its badges
	badge: string | null;
	area: string | null;
	group: string | null;
};

type Ctx = { ctx: PlanCtx; names: LabelCtx; saves: Snapshot[] };

/** What the checks read, from the branch's saves (null before the first full save). */
export function planCtx(snaps: Snapshot[]): Ctx | null {
	const saves = snaps.filter((s) => s.progress !== null);
	const latest = saves.at(-1);
	if (!latest) return null;
	const data = getGameData();
	const galaxy = campaignGalaxy(latest.campaign)?.systems ?? null;
	const f = facts(latest, data.scriptedTriggers);
	const possible: PlanCtx['possible'] = (p) => evaluate(p, f);
	const fits = new Map<string, Map<number, boolean | null>>();
	const megaFit = (kind: string, systemId: number) => {
		if (!galaxy || !(MEGA_KINDS as readonly string[]).includes(kind)) return null;
		if (!fits.has(kind)) {
			const known = discovered(galaxy, { whole: false, stars: false });
			const rows = candidates(kind as MegaKind, known, jumpsFromBorder(known), data);
			fits.set(kind, new Map(rows.map((r) => [r.systemId, r.ok])));
		}
		return fits.get(kind)!.get(systemId) ?? null;
	};
	const ctx: PlanCtx = {
		latest,
		galaxy,
		data,
		possible,
		reach: inReach(latest.progress?.researched ?? [], data.techs, data.techRequirements, possible),
		districtCap: (planetId, district) => {
			const d = colonyDetails(
				latest.colonies.find((c) => c.planetId === planetId),
				latest
			);
			const t = d?.caps.types.find((x) => x.district === district);
			return t ? { cap: t.cap, blocked: t.blocked } : null;
		},
		megaFit,
		seen: seenAlong(saves)
	};
	const bodies = new Map(
		(galaxy ?? []).flatMap((s) => (s.bodies ?? []).map((b) => [b.id, b.name] as const))
	);
	const systemNames = new Map([
		...(latest.knownSystems ?? []).map((k) => [k.id, k.name] as const),
		...(galaxy ?? []).filter((s) => s.visited || s.owned).map((s) => [s.id, s.name] as const)
	]);
	const countryNames = new Map<number, string>([
		...(latest.countries ?? []).map((c) => [c.id, c.name] as const),
		...(latest.firstContacts ?? []).map((c) => [c.countryId, c.name] as const),
		...(latest.relations ?? []).map((r) => [r.countryId, r.name] as const)
	]);
	const names: LabelCtx = {
		data,
		system: (id) => systemNames.get(id) ?? `system ${id}`,
		planet: (id) =>
			latest.colonies.find((c) => c.planetId === id)?.name ??
			bodies.get(id) ??
			latest.expansion?.find((e) => e.planetId === id)?.name ??
			latest.anomalies?.find((a) => a.planetId === id)?.planet ??
			`planet ${id}`,
		country: (id) => countryNames.get(id) ?? `empire ${id}`
	};
	return { ctx, names, saves };
}

const systemOf = (g: Goal, c: PlanCtx) => KINDS[g.kind]?.system?.(g.target, c) ?? null;

function row(g: Goal, c: Ctx, dates: Map<number, string>): GoalRow {
	const st = check(g.kind, g.target, g.checked, c.ctx);
	const k = KINDS[g.kind];
	// since when it holds: walked back over the saves, the galaxy kept to the latest (it is the
	// campaign's latest reading, not per save) — a save that cannot tell ends the walk
	const since =
		st.state === 'done' && !k?.manual
			? holdsSince(c.saves, (s) =>
					s === c.ctx.latest
						? st.state
						: check(g.kind, g.target, g.checked, { ...c.ctx, latest: s, galaxy: null }).state
				)
			: null;
	return {
		...g,
		group: groupOf(g.kind),
		label: label(g.kind, g.target, g.title, c.names),
		ref: k?.ref?.(g.target) ?? null,
		systemId: systemOf(g, c.ctx),
		state: st.state,
		why: st.why ?? null,
		since,
		manual: k?.manual ?? false,
		badge: badgeOf(g.kind, g.target, getGameData()),
		area: areaOf(g.kind, g.target, getGameData()),
		dependents: [],
		added: { ...g.added, date: dates.get(g.added.nodeId) ?? null }
	};
}

/** Campaign → the other branches' tips with their paths (for "from another branch"). */
function branchesOf(campaign: string, here: number) {
	const all = nodes(getDb());
	const mine = all.filter((n) => n.campaign === campaign);
	const byId = new Map(all.map((n) => [n.id, n]));
	const pathOf = (id: number) => {
		const out: number[] = [];
		for (let n = byId.get(id); n; n = byId.get(n.parentId ?? -1)) out.push(n.id);
		return out.reverse();
	};
	return leaves(mine)
		.filter((id) => id !== here)
		.map((tip) => ({ tip, path: pathOf(tip), date: byId.get(tip)?.date ?? '' }));
}

/** The node path (root to tip) and its game dates. */
function pathOf(tip: number) {
	const all = nodes(getDb());
	const byId = new Map(all.map((n) => [n.id, n]));
	const out: number[] = [];
	for (let n = byId.get(tip); n; n = byId.get(n.parentId ?? -1)) out.push(n.id);
	return {
		path: out.reverse(),
		dates: new Map(all.map((n) => [n.id, n.date])),
		// the later branches a change made here also reaches: leaves below the tip, itself excluded
		below: (() => {
			const children = new Map<number, number[]>();
			for (const n of all)
				if (n.parentId !== null)
					(children.get(n.parentId) ?? children.set(n.parentId, []).get(n.parentId)!).push(n.id);
			let count = 0;
			const walk = (id: number) => {
				const kids = children.get(id) ?? [];
				if (!kids.length && id !== tip) count++;
				kids.forEach(walk);
			};
			walk(tip);
			return count;
		})()
	};
}

function describe(e: PlanEvent, goals: Map<string, { label: string }>): HistoryRow['detail'] {
	const d = (e.data ?? {}) as Record<string, unknown>;
	switch (e.op) {
		case 'add':
			return [
				d.polarity === 'avoid' ? 'avoid' : 'want',
				d.parked ? 'parked' : '',
				d.from ? 'copied from another branch' : ''
			]
				.filter(Boolean)
				.join(', ');
		case 'edit':
			return Object.entries(d)
				.map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
				.join('; ');
		case 'order':
			return `${GROUPS.find((g) => `group:${g.id}` === e.goal)?.name ?? e.goal}: ${(Array.isArray(
				d.ids
			)
				? d.ids
				: []
			)
				.map((id) => goals.get(String(id))?.label ?? '?')
				.slice(0, 5)
				.join(' → ')}${Array.isArray(d.ids) && d.ids.length > 5 ? ' …' : ''}`;
		default:
			return '';
	}
}

/**
 * The popups the rows need: the game data's (techs, traditions, perks, buildings, static modifiers
 * — a Wanderlust category's reward), and focus cards, explained here from the data DB: what the
 * card asks, the focus progress it gives, and each category's next reward.
 */
function explanations(refs: string[], c: Ctx | null): Record<string, Explanation> {
	const out = pick(getExplanations(), refs) as Record<string, Explanation>;
	const focus = getGameData().focus;
	const techs = getGameData().techs;
	for (const ref of refs) {
		const place = /^(outpost|waystation):(\d+)$/.exec(ref);
		if (place) {
			out[ref] = systemInfo(
				c?.ctx.galaxy?.find((x) => x.id === Number(place[2])),
				place[1] as 'outpost' | 'waystation',
				getGameData(),
				c?.ctx.latest.countries ?? [],
				display().surveyAll
			);
			continue;
		}
		if (!ref.startsWith('focuscard:')) continue;
		const card = focus.cards[ref.slice('focuscard:'.length)];
		if (!card) continue;
		const next = (category: string) => {
			const key = c?.ctx.latest.focus?.rewards.find((r) => r.category === category)?.current;
			const reward = key ? focus.rewards[key] : undefined;
			return reward
				? ` — next reward${reward.cost !== null ? ` at ${reward.cost}` : ''}: ${reward.options.map((o) => techs[o.tech]?.name ?? o.tech).join(' or ')}`
				: '';
		};
		out[ref] = {
			title: card.name,
			description: card.hint,
			modifiers: [],
			text: card.requirement,
			facts: [
				...(card.tier !== null ? [`tier ${card.tier}`] : []),
				...card.gives.map(
					(g) =>
						`+${g.amount} ${focus.categories[g.category] ?? g.category} progress${next(g.category)}`
				)
			]
		};
	}
	return out;
}

/**
 * The plan at a node over what the save and the plan imply: the adopted trees' traditions and the
 * perks taken (`autoGoals`), then what each planned tech still needs (`techNeeds`).
 */
function planFor(events: PlanEvent[], path: number[], c: Ctx | null): Plan {
	return planWithNeeds(events, path, c).plan;
}

/**
 * `planFor` and, per goal the player added, the automatic goals only it brings — what removing it
 * takes along (the user's ask: "ask whether their requirements should be removed too"); none that
 * another goal or the save implies.
 */
function planWithNeeds(
	events: PlanEvent[],
	path: number[],
	c: Ctx | null
): { plan: Plan; dependents: Record<string, string[]> } {
	if (!c) return { plan: planAt(events, path), dependents: {} };
	const data = getGameData();
	const saved = autoGoals(c.ctx.latest, data);
	const first = planAt(events, path, saved);
	const researched = c.ctx.latest.progress?.researched ?? [];
	const wantedOf = (kind: string) =>
		[...first.goals.values()].filter(
			(g) => g.kind === kind && !g.parked && g.polarity === 'want' && (kind === 'tech' || !g.auto)
		);
	const techsNeeded = (techs: string[]) =>
		techNeeds(techs, researched, data.techs, data.techRequirements, c.ctx.possible);
	// a planned adoption brings its tree, a planned pick its adoption and the picks it needs
	const auto = autoGoals(
		c.ctx.latest,
		data,
		wantedOf('tradition').map((g) => String(g.target.tradition))
	);
	const needs = techsNeeded(wantedOf('tech').map((g) => String(g.target.tech)));
	const plan = planAt(events, path, [...auto, ...needs]);
	// what each added goal brings by itself
	const fromSave = new Set(saved.map((g) => g.id));
	const brings = [...wantedOf('tech'), ...wantedOf('tradition')]
		.filter((g) => !g.auto)
		.map((g): [string, Set<string>] => [
			g.id,
			new Set(
				(g.kind === 'tech'
					? techsNeeded([String(g.target.tech)])
					: autoGoals(c.ctx.latest, data, [String(g.target.tradition)])
				)
					.map((x) => x.id)
					.filter((id) => !fromSave.has(id) && plan.goals.get(id)?.auto)
			)
		]);
	const dependents = Object.fromEntries(
		brings.map(([id, set]) => [
			id,
			[...set].filter((x) => !brings.some(([other, s2]) => other !== id && s2.has(x)))
		])
	);
	return { plan, dependents };
}

/** Everything the planner tab shows for the branch ending at `tip`. */
export function plannerPage(snaps: Snapshot[], tip: number) {
	const c = planCtx(snaps);
	const campaign = snaps.at(-1)?.campaign ?? '';
	const events = planEvents(getDb(), campaign);
	const { path, dates, below } = pathOf(tip);
	const { plan, dependents } = planWithNeeds(events, path, c);
	const picked = c?.ctx.latest.traditions ?? [];
	const groups = arrange(plan, groupOf, (group, list) =>
		group === 'traditions'
			? orderTraditions(list, getGameData(), picked)
			: group === 'research'
				? orderResearch(list, getGameData())
				: list
	);
	const others = c ? otherBranches(events, branchesOf(campaign, tip), plan) : [];
	const toRow = (g: Goal) =>
		c ? { ...row(g, c, dates), dependents: dependents[g.id] ?? [] } : null;
	const rows = Object.fromEntries(
		GROUPS.map((g) => [g.id, (groups[g.id] ?? []).map(toRow).filter((r) => r !== null)])
	) as Record<string, GoalRow[]>;
	const parkedRows = parked(plan)
		.map(toRow)
		.filter((r) => r !== null);
	// labels for the history, from every goal ever added on this branch
	// what each history entry is about, for its label and badges: every goal ever added on this
	// branch, and the automatic ones (they have no add of their own)
	type About = {
		label: string;
		kind: string;
		badge: string | null;
		area: string | null;
		group: string;
	};
	const labels = new Map<string, About>();
	const about = (kind: string, target: Target, title: string): About | null =>
		c
			? {
					label: label(kind, target, title, c.names),
					kind,
					badge: badgeOf(kind, target, getGameData()),
					area: areaOf(kind, target, getGameData()),
					group: GROUPS.find((g) => g.id === groupOf(kind))?.name ?? ''
				}
			: null;
	for (const g of plan.goals.values()) {
		const a = about(g.kind, g.target, g.title);
		if (a) labels.set(g.id, a);
	}
	for (const e of plan.history)
		if (e.op === 'add' && !labels.has(e.goal)) {
			const d = e.data as { kind: string; target: Target; title?: string };
			const a = about(d.kind, d.target ?? {}, d.title ?? '');
			if (a) labels.set(e.goal, a);
		}
	const all = [...Object.values(rows).flat(), ...parkedRows];
	const suggested = c ? suggestions(c, plan) : [];
	const otherRows = c ? others.map((g) => ({ ...row(g, c, dates), tips: g.tips })) : [];
	return {
		groups: GROUPS.map((g) => ({ ...g, goals: rows[g.id] })),
		parked: parkedRows,
		others: otherRows,
		history: plan.history
			.map((e) => ({
				id: e.id,
				at: e.at,
				date: dates.get(e.nodeId) ?? null,
				op: e.op,
				goal: e.goal,
				label: labels.get(e.goal)?.label ?? (e.op === 'order' ? 'order' : e.goal),
				detail: describe(e, labels),
				kind: labels.get(e.goal)?.kind ?? null,
				badge: labels.get(e.goal)?.badge ?? null,
				area: labels.get(e.goal)?.area ?? null,
				group:
					labels.get(e.goal)?.group ?? GROUPS.find((g) => `group:${g.id}` === e.goal)?.name ?? null
			}))
			.reverse(),
		// done moments derived from the saves, for the history
		doneAt: all
			.filter((r) => r.since)
			.map((r) => ({
				goal: r.id,
				label: r.label,
				...r.since!,
				avoid: r.polarity === 'avoid',
				kind: r.kind,
				badge: r.badge,
				area: r.area,
				group: GROUPS.find((g) => g.id === r.group)?.name ?? null
			})),
		suggestions: suggested,
		options: c ? fieldOptions(c) : {},
		kinds: Object.entries(KINDS)
			.filter(([id]) => !c || !unavailable(c.ctx.latest).includes(id))
			.map(([id, k]) => ({
				id,
				group: k.group,
				name: k.name,
				fields: k.fields,
				manual: k.manual ?? false
			})),
		explain: explanations(
			[...all, ...otherRows, ...suggested].map((r) => r.ref ?? null).filter((r) => r !== null),
			c
		),
		laterBranches: below,
		isHead: tip === headId(getDb()),
		seenAt: c?.ctx.latest.date ?? null
	};
}

/** The add form's choices per source (`sourceOf`), names as the game shows them. */
function fieldOptions(c: Ctx): Record<string, Option[]> {
	const { ctx, names } = c;
	const d = getGameData();
	const by = (o: Option[]) => o.sort((a, b) => a.label.localeCompare(b.label));
	const keyed = (r: Record<string, unknown>, name: (k: string) => string) =>
		by(Object.keys(r).map((k) => ({ value: k, label: name(k) })));
	const visited = (ctx.galaxy ?? []).filter((s) => s.visited || s.owned);
	const countries = new Set([
		...(ctx.latest.firstContacts ?? []).map((f) => f.countryId),
		...(ctx.latest.relations ?? []).map((r) => r.countryId)
	]);
	return {
		system: by(
			(ctx.galaxy ?? [])
				.filter((s) => s.visited || s.owned || s.lanesKnown)
				.map((s) => ({ value: s.id, label: names.system(s.id) }))
		),
		planet: by(
			visited.flatMap((s) =>
				(s.bodies ?? [])
					.filter((b) => !b.star)
					.map((b) => ({ value: b.id, label: `${b.name} (${s.name})` }))
			)
		),
		colonies: by(ctx.latest.colonies.map((col) => ({ value: col.planetId, label: col.name }))),
		tech: keyed(d.techs, (k) => d.techs[k].name),
		tradition: by(
			Object.values(d.traditionTrees).flatMap((t) =>
				t.traditions.map((x) => ({ value: x.key, label: traditionName(x.key, d) }))
			)
		),
		perk: keyed(d.perks, (k) => d.perks[k]),
		building: keyed(d.costs.building, (k) => d.names[k] ?? k),
		district: keyed(d.costs.district, (k) => d.names[k] ?? k),
		modules: keyed(d.costs.module, (k) => d.names[k] ?? k),
		starbaseBuildings: keyed(d.costs.starbaseBuilding, (k) => d.names[k] ?? k),
		level: STATION_LEVELS.map((l) => ({ value: l, label: l })),
		type: Object.entries(ARKSHIPS).map(([value, label]) => ({ value, label })),
		area: AREAS.map((a) => ({ value: a, label: a })),
		structure: MEGA_KINDS.map((k) => ({ value: k, label: MEGA_RULES[k].name })),
		situation: keyed(d.situationTypes, (k) => d.situationTypes[k].name),
		approach: by(
			Object.values(d.situationTypes).flatMap((t) =>
				Object.entries(t.approaches).map(([k, v]) => ({ value: k, label: `${v} · ${t.name}` }))
			)
		),
		country: by([...countries].map((id) => ({ value: id, label: names.country(id) }))),
		category: WANDERLUST.map((w) => ({ value: w.key, label: w.name })),
		card: keyed(d.focus.cards, (k) => d.focus.cards[k].name),
		key: keyed(
			Object.fromEntries(
				Object.entries(d.identityNames).filter(([k]) => /^(civic|auth|ethic)_/.test(k))
			),
			(k) => d.identityNames[k]
		),
		govtype: keyed(
			Object.fromEntries(Object.entries(d.identityNames).filter(([k]) => k.startsWith('gov_'))),
			(k) => d.identityNames[k]
		)
	};
}

const LIMIT = 12;

/** Goals worth planning, per group, from what the save shows (none already in the plan). */
function suggestions(c: Ctx, plan: Plan): Suggestion[] {
	const { ctx, names } = c;
	const have = new Set([...plan.goals.values()].map((g) => goalKey(g.kind, g.target, g.title)));
	const out: Suggestion[] = [];
	const off = unavailable(ctx.latest);
	const add = (kind: string, list: { target: Target; why?: string }[]) => {
		if (off.includes(kind)) return;
		let n = 0;
		for (const x of list) {
			if (n >= LIMIT) break;
			if (have.has(goalKey(kind, x.target))) continue;
			if (check(kind, x.target, false, ctx).state === 'done') continue;
			out.push({
				kind,
				target: x.target,
				label: label(kind, x.target, '', names),
				why: x.why,
				ref: KINDS[kind]?.ref?.(x.target) ?? null,
				badge: badgeOf(kind, x.target, getGameData()),
				area: areaOf(kind, x.target, getGameData())
			});
			n++;
		}
	};
	const l = ctx.latest;
	const d = ctx.data;
	add(
		'survey',
		(ctx.galaxy ?? [])
			.filter((s) => s.bodies?.some((b) => !b.star && !b.surveyed))
			.map((s) => ({ target: { system: s.id } }))
	);
	add(
		'anomaly',
		(l.anomalies ?? []).map((a) => ({
			target: { planet: a.planetId },
			why: d.anomalyCategories[a.category]?.name
		}))
	);
	add(
		'digsite',
		(l.digSites ?? []).map((x) => ({
			target: { planet: x.planetId },
			why: `difficulty ${x.difficulty}`
		}))
	);
	add(
		'wanderlust',
		(l.wanderlust?.categories ?? [])
			.filter((x) => !x.done)
			.map((x) => ({ target: { category: x.key }, why: `${x.seen} of ${x.count}` }))
	);
	add(
		'outpost',
		(ctx.galaxy ?? [])
			.filter((s) => s.visited && !s.owned && s.ownerId === null)
			.map((s) => ({ target: { system: s.id } }))
	);
	add(
		'waystation',
		(ctx.galaxy ?? [])
			.filter((x) => x.bodies && !ctx.latest.stations?.some((st) => st.systemId === x.id))
			.map((x) => ({
				x,
				n: x.bodies!.reduce(
					(a, b) =>
						a +
						(display().surveyAll || b.surveyed !== false ? b.deposits : []).filter((dep) =>
							/^orbital_/.test(getGameData().depositCategories[dep] ?? '')
						).length,
					0
				)
			}))
			.filter((e) => e.n > 0)
			.sort((a, b) => b.n - a.n)
			.map((e) => ({ target: { system: e.x.id }, why: `${e.n} deposit${e.n === 1 ? '' : 's'}` }))
	);
	add(
		'arkship',
		Object.keys(ARKSHIPS).map((type) => {
			const have = arkships(l, type);
			return { target: { type, count: have + 1 }, why: `${have} now` };
		})
	);
	add(
		'colony',
		[...(l.expansion ?? [])]
			.sort((a, b) => (a.beyond ?? 99) - (b.beyond ?? 99) || b.size - a.size)
			.map((e) => ({
				target: { planet: e.planetId },
				why: `${e.planetClass.replace(/^pc_/, '')} ${e.size}`
			}))
	);
	add(
		'station_level',
		(l.stations ?? [])
			.filter(
				(st) =>
					st.systemId != null &&
					STATION_LEVELS.indexOf(st.level) >= 0 &&
					STATION_LEVELS.indexOf(st.level) < STATION_LEVELS.length - 1
			)
			.map((st) => ({
				target: {
					system: st.systemId!,
					level: STATION_LEVELS[STATION_LEVELS.indexOf(st.level) + 1]
				},
				why: `now ${st.level}`
			}))
	);
	add(
		'district',
		l.colonies.flatMap((col) =>
			(colonyDetails(col, l)?.caps.types ?? [])
				.filter((t) => t.cap !== null && t.built < t.cap)
				.map((t) => ({
					target: { planet: col.planetId, district: t.district, count: t.cap! },
					why: `${t.built} of ${t.cap} built`
				}))
		)
	);
	const researched = new Set(l.progress?.researched ?? []);
	add(
		'tech',
		[...(l.techPermanent ?? []), ...ctx.reach]
			.filter((k, i, a) => !researched.has(k) && a.indexOf(k) === i)
			.map((k) => ({
				target: { tech: k },
				why: l.techPermanent?.includes(k) ? 'permanent option' : `tier ${d.techs[k]?.tier ?? '?'}`
			}))
	);
	const taken = new Set(l.traditions ?? []);
	// the trees a planned or taken perk opens (The Flesh is Weak → Cybernetics)
	add(
		'tradition',
		[...plan.goals.values()]
			.filter((g) => g.kind === 'perk' && g.polarity === 'want')
			.flatMap((g) =>
				(d.perkTrees[String(g.target.perk)] ?? []).flatMap((tree) => {
					const adopt = d.traditionTrees[tree]?.traditions.find((t) => t.role === 'adopt')?.key;
					return adopt && !taken.has(adopt)
						? [
								{
									target: { tradition: adopt },
									why: `opened by ${d.perks[String(g.target.perk)] ?? g.target.perk}`
								}
							]
						: [];
				})
			)
	);
	add(
		'tradition',
		Object.values(d.traditionTrees).flatMap((tree) => {
			const adopted = tree.traditions.some((t) => t.role === 'adopt' && taken.has(t.key));
			return tree.traditions
				.filter(
					(t) =>
						(adopted ? t.role !== 'adopt' && t.role !== 'finish' : t.role === 'adopt') &&
						!taken.has(t.key)
				)
				.map((t) => ({ target: { tradition: t.key }, why: tree.name }));
		})
	);
	add(
		'perk',
		Object.keys(d.perks)
			.filter((k) => !(l.ascensionPerks ?? []).includes(k))
			.map((k) => ({ target: { perk: k } }))
	);
	add(
		'focus_card',
		(l.focus?.cards ?? [])
			.filter((x) => !x.done)
			.map((x) => ({ target: { card: x.key }, why: 'on offer' }))
	);
	add(
		'situation_approach',
		(l.situations ?? []).flatMap((x) =>
			Object.keys(d.situationTypes[x.type]?.approaches ?? {})
				.filter((a) => a !== x.approach)
				.map((a) => ({ target: { situation: x.type, approach: a } }))
		)
	);
	add(
		'contact',
		(l.firstContacts ?? [])
			.filter((f) => f.status === 'in_progress')
			.map((f) => ({ target: { country: f.countryId }, why: `difficulty ${f.difficulty}` }))
	);
	return out;
}

/** The goals that fit one system, for the map's right-click menu. */
export function systemGoals(snaps: Snapshot[], systemId: number): Suggestion[] {
	const c = planCtx(snaps);
	if (!c) return [];
	const { ctx, names } = c;
	const s = ctx.galaxy?.find((x) => x.id === systemId);
	const out: { kind: string; target: Target; why?: string }[] = [];
	if (s?.bodies?.some((b) => !b.star && !b.surveyed))
		out.push({ kind: 'survey', target: { system: systemId } });
	if (!s?.owned && !unavailable(ctx.latest).includes('outpost'))
		out.push({ kind: 'outpost', target: { system: systemId } });
	if (!unavailable(ctx.latest).includes('waystation'))
		out.push({ kind: 'waystation', target: { system: systemId } });
	for (const b of s?.bodies ?? []) {
		if (b.star) continue;
		const colony = ctx.latest.colonies.some((col) => col.planetId === b.id);
		const habitable = getGameData().planetClasses[b.class]?.colonizable === true;
		if (!colony && !b.colonized && (habitable || /habitat|ring/.test(b.class)))
			out.push({ kind: 'colony', target: { planet: b.id }, why: b.class.replace(/^pc_/, '') });
	}
	for (const a of ctx.latest.anomalies ?? [])
		if (a.systemId === systemId) out.push({ kind: 'anomaly', target: { planet: a.planetId } });
	for (const x of ctx.latest.digSites ?? [])
		if (x.systemId === systemId) out.push({ kind: 'digsite', target: { planet: x.planetId } });
	const st = ctx.latest.stations?.find((x) => x.systemId === systemId);
	const lvl = st ? STATION_LEVELS.indexOf(st.level) : -1;
	if (st && lvl >= 0 && lvl < STATION_LEVELS.length - 1)
		out.push({
			kind: 'station_level',
			target: { system: systemId, level: STATION_LEVELS[lvl + 1] }
		});
	for (const k of MEGA_KINDS)
		if (ctx.megaFit(k, systemId))
			out.push({ kind: 'megastructure', target: { system: systemId, structure: k } });
	if (ctx.latest.wanderlust && s?.wanderlust?.length)
		out.push({ kind: 'wanderlust_visit', target: { system: systemId }, why: 'to avoid' });
	return out.map((x) => ({ ...x, label: label(x.kind, x.target, '', names) }));
}

/** Systems with goals on this branch, for the map's "planned" layer. */
export function plannedSystems(snaps: Snapshot[], tip: number): Record<number, string[]> {
	const c = planCtx(snaps);
	if (!c) return {};
	const plan = planAt(planEvents(getDb(), c.ctx.latest.campaign), pathOf(tip).path);
	const out: Record<number, string[]> = {};
	for (const g of plan.goals.values()) {
		const id = systemOf(g, c.ctx);
		if (id !== null) (out[id] ??= []).push(label(g.kind, g.target, g.title, c.names));
	}
	return out;
}

let memo: {
	key: string;
	value: { keys: string[]; alerts: number; unavailable: string[] };
} | null = null;

/**
 * For the tab bar and the "+ goal" buttons on every page: the plan's goal keys at the node shown,
 * and how many need attention — blocked, or avoided and happened. Cached by tip and plan.
 */
export function planSummary(tip: number | null): {
	keys: string[];
	alerts: number;
	unavailable: string[];
} {
	if (tip === null) return { keys: [], alerts: 0, unavailable: [] };
	const db = getDb();
	const node = nodes(db).find((n) => n.id === tip);
	if (!node) return { keys: [], alerts: 0, unavailable: [] };
	const events = planEvents(db, node.campaign);
	const key = `${tip}:${events.at(-1)?.id ?? 0}:${events.length}`;
	if (memo?.key === key) return memo.value;
	const c = planCtx(history(db, tip));
	const plan = planFor(events, pathOf(tip).path, c);
	const goals = [...plan.goals.values()];
	let alerts = 0;
	{
		if (c)
			for (const g of goals) {
				if (g.parked) continue;
				const st = check(g.kind, g.target, g.checked, c.ctx).state;
				if (st === 'blocked' && g.polarity === 'want') alerts++;
				if (st === 'done' && g.polarity === 'avoid') alerts++;
			}
	}
	memo = {
		key,
		value: {
			keys: goals.map((g) => goalKey(g.kind, g.target, g.title)),
			alerts,
			unavailable: c ? unavailable(c.ctx.latest) : []
		}
	};
	return memo.value;
}
