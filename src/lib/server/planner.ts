import { facts } from '#lib/government.ts';
import {
	candidates,
	KINDS as MEGA_KINDS,
	MEGA_RULES,
	type Kind as MegaKind
} from '#lib/megastructures.ts';
import {
	check,
	GROUPS,
	groupOf,
	KINDS,
	label,
	STATION_LEVELS,
	traditionName,
	type LabelCtx,
	type PlanCtx,
	type State
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
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import { inReach } from '#lib/techTiers.ts';
import { evaluate } from '#lib/triggers.ts';
import type { Explanation, Snapshot } from '#lib/types.ts';
import { WANDERLUST } from '#lib/wanderlust.ts';
import { getDb, getExplanations, getGameData } from './app.ts';
import { headId, history, nodes, planEvents } from './db.ts';
import { pick } from './explain.ts';
import { campaignGalaxy } from './mapSystems.ts';
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
	added: { nodeId: number; at: string; date: string | null };
};
export type Option = { value: string | number; label: string };
export type Suggestion = { kind: string; target: Target; label: string; why?: string };
export type HistoryRow = {
	id: number;
	at: string;
	date: string | null; // the game date of the node it was made at
	op: string;
	goal: string;
	label: string;
	detail: string;
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

/** Everything the planner tab shows for the branch ending at `tip`. */
export function plannerPage(snaps: Snapshot[], tip: number) {
	const c = planCtx(snaps);
	const campaign = snaps.at(-1)?.campaign ?? '';
	const events = planEvents(getDb(), campaign);
	const { path, dates, below } = pathOf(tip);
	const plan = planAt(events, path);
	const groups = arrange(plan, groupOf);
	const others = c ? otherBranches(events, branchesOf(campaign, tip), plan) : [];
	const toRow = (g: Goal) => (c ? row(g, c, dates) : null);
	const rows = Object.fromEntries(
		GROUPS.map((g) => [g.id, (groups[g.id] ?? []).map(toRow).filter((r) => r !== null)])
	) as Record<string, GoalRow[]>;
	const parkedRows = parked(plan)
		.map(toRow)
		.filter((r) => r !== null);
	// labels for the history, from every goal ever added on this branch
	const labels = new Map<string, { label: string }>();
	for (const e of plan.history)
		if (e.op === 'add' && c) {
			const d = e.data as { kind: string; target: Target; title?: string };
			labels.set(e.goal, { label: label(d.kind, d.target ?? {}, d.title ?? '', c.names) });
		}
	const all = [...Object.values(rows).flat(), ...parkedRows];
	return {
		groups: GROUPS.map((g) => ({ ...g, goals: rows[g.id] })),
		parked: parkedRows,
		others: c ? others.map((g) => ({ ...row(g, c, dates), tips: g.tips })) : [],
		history: plan.history
			.map((e) => ({
				id: e.id,
				at: e.at,
				date: dates.get(e.nodeId) ?? null,
				op: e.op,
				goal: e.goal,
				label: labels.get(e.goal)?.label ?? (e.op === 'order' ? 'order' : e.goal),
				detail: describe(e, labels)
			}))
			.reverse(),
		// done moments derived from the saves, for the history
		doneAt: all
			.filter((r) => r.since)
			.map((r) => ({ goal: r.id, label: r.label, ...r.since!, avoid: r.polarity === 'avoid' })),
		suggestions: c ? suggestions(c, plan) : [],
		options: c ? fieldOptions(c) : {},
		kinds: Object.entries(KINDS).map(([id, k]) => ({
			id,
			group: k.group,
			name: k.name,
			fields: k.fields,
			manual: k.manual ?? false
		})),
		explain: pick(
			getExplanations(),
			all.map((r) => r.ref).filter((r) => r !== null)
		) as Record<string, Explanation>,
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
				t.traditions.map((x) => ({ value: x.key, label: `${traditionName(x.key, d)} · ${t.name}` }))
			)
		),
		perk: keyed(d.perks, (k) => d.perks[k]),
		building: keyed(d.costs.building, (k) => d.names[k] ?? k),
		district: keyed(d.costs.district, (k) => d.names[k] ?? k),
		modules: keyed(d.costs.module, (k) => d.names[k] ?? k),
		starbaseBuildings: keyed(d.costs.starbaseBuilding, (k) => d.names[k] ?? k),
		level: STATION_LEVELS.map((l) => ({ value: l, label: l })),
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
	const add = (kind: string, list: { target: Target; why?: string }[]) => {
		let n = 0;
		for (const x of list) {
			if (n >= LIMIT) break;
			if (have.has(goalKey(kind, x.target))) continue;
			if (check(kind, x.target, false, ctx).state === 'done') continue;
			out.push({ kind, target: x.target, label: label(kind, x.target, '', names), why: x.why });
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
	if (!s?.owned) out.push({ kind: 'outpost', target: { system: systemId } });
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

let memo: { key: string; value: { keys: string[]; alerts: number } } | null = null;

/**
 * For the tab bar and the "+ goal" buttons on every page: the plan's goal keys at the node shown,
 * and how many need attention — blocked, or avoided and happened. Cached by tip and plan.
 */
export function planSummary(tip: number | null): { keys: string[]; alerts: number } {
	if (tip === null) return { keys: [], alerts: 0 };
	const db = getDb();
	const node = nodes(db).find((n) => n.id === tip);
	if (!node) return { keys: [], alerts: 0 };
	const events = planEvents(db, node.campaign);
	const key = `${tip}:${events.at(-1)?.id ?? 0}:${events.length}`;
	if (memo?.key === key) return memo.value;
	const plan = planAt(events, pathOf(tip).path);
	const goals = [...plan.goals.values()];
	let alerts = 0;
	if (goals.length) {
		const c = planCtx(history(db, tip));
		if (c)
			for (const g of goals) {
				if (g.parked) continue;
				const st = check(g.kind, g.target, g.checked, c.ctx).state;
				if (st === 'blocked' && g.polarity === 'want') alerts++;
				if (st === 'done' && g.polarity === 'avoid') alerts++;
			}
	}
	memo = { key, value: { keys: goals.map((g) => goalKey(g.kind, g.target, g.title)), alerts } };
	return memo.value;
}
