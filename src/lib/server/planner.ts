import { buildingNeeds, ownSituations } from '#lib/buildingWays.ts';
import { forEmpire } from '#lib/costs.ts';
import { pretty } from '#lib/format.ts';
import { facts } from '#lib/government.ts';
import {
	candidates,
	KINDS as MEGA_KINDS,
	MEGA_RULES,
	type Kind as MegaKind
} from '#lib/megastructures.ts';
import {
	ARKSHIPS,
	ARKSHIP_TECHS,
	ASCENSION_SITUATIONS,
	arkships,
	areaOf,
	ascensionOf,
	autoGoals,
	badgeOf,
	check,
	orderFocus,
	rewardIndex,
	rewardLabel,
	orderResearch,
	tintOf,
	orderTraditions,
	suggestionLimit,
	suggestionVisible,
	uniquePerks,
	GROUPS,
	dueOf,
	nextTradition,
	share,
	groupOf,
	KINDS,
	label,
	nomadic,
	STATION_LEVELS,
	traditionName,
	type LabelCtx,
	type PlanCtx,
	type State,
	unavailable
} from '#lib/planner/kinds.ts';
import { techCost, type Upcoming } from '#lib/events.ts';
import {
	arrange,
	goalKey,
	leaves,
	otherBranches,
	parked,
	planAt,
	wanted,
	type AutoGoal,
	type Goal,
	type Plan,
	type PlanEvent,
	type Target
} from '#lib/planner/replay.ts';
import { costRows, incomeRates, type CostRow } from '#lib/planner/eta.ts';
import { holdsSince, seenAlong, type Since } from '#lib/planner/status.ts';
import { storageRows } from '#lib/storage.ts';
import type { Stance } from '#lib/techOffers.ts';
import { SHORTCUTS, shortcutRows } from '#lib/planner/shortcuts.ts';
import { systemInfo } from '#lib/planner/systemInfo.ts';
import { techNeeds } from '#lib/planner/needs.ts';
import { blockNeeds, techsAsked, withTechs } from '#lib/planner/asks.ts';
import { AREAS, inReach } from '#lib/techTiers.ts';
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import { evaluate } from '#lib/triggers.ts';
import type { Explanation, Snapshot } from '#lib/types.ts';
import { WANDERLUST, counted, countsFor, outlook, wanderlustName } from '#lib/wanderlust.ts';
import { getDb, getExplanations, getGameData } from './app.ts';
import { headId, history, nodeById, nodes, planEvents } from './db.ts';
import { pick } from './explain.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { display, setting } from './settings.ts';
import { outcomeNow, outcomeTips } from './outcomes.ts';
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
	percent: number | null; // how far it has come (`Status.percent`)
	due: { date: string; exact: boolean } | null; // when it is done, from the upcoming events
	waiting: boolean; // open, but what it needs comes first (`Status.waiting`)
	since: Since | null;
	manual: boolean;
	badge: string | null; // a tech's tier, a tradition's place in its tree, a perk
	ascension: boolean;
	area: string | null; // a tech's research area
	tint: string | null; // the badge's colour, a colors.ts key (research or focus area)
	dependents: string[]; // the automatic goals only this one brings (removed with it, if wished)
	cost: CostRow | null; // what it still costs and when it is paid and built (#lib/planner/eta.ts)
	added: { nodeId: number; at: string; date: string | null };
};
export type Option = { value: string | number; label: string };
export type Suggestion = {
	kind: string;
	target: Target;
	label: string;
	why?: string;
	tip?: string | null; // what an anomaly or dig site leads to (behind its spoiler switch)
	unavailable?: boolean;
	ref?: string | null; // a popup with its effects
	badge?: string | null;
	ascension?: boolean;
	area?: string | null;
	tint?: string | null;
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
	ascension: boolean;
	area: string | null;
	tint: string | null;
	group: string | null;
};

type Ctx = { ctx: PlanCtx; names: LabelCtx; saves: Snapshot[]; upcoming: Upcoming[] };

/** What the checks read, from the branch's saves (null before the first full save). */
export function planCtx(snaps: Snapshot[], upcoming: Upcoming[] = []): Ctx | null {
	const saves = snaps.filter((s) => s.progress !== null);
	const latest = saves.at(-1);
	if (!latest) return null;
	const data = forEmpire(getGameData(), latest); // this empire's costs (#lib/costs.ts)
	const galaxy = campaignGalaxy(latest.campaign)?.systems ?? null;
	const f = facts(latest, data.scriptedTriggers, { shipKinds: data.shipKinds });
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
	const seen = seenAlong(saves);
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
		buildingNeeds: (b) => {
			const p = data.buildingPotential?.[b];
			return p ? buildingNeeds(p, data, f, ownSituations(latest, seen.situations, data, f)) : null;
		},
		techCost: (k) => techCost(k, latest, data),
		seen
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
		possible,
		system: (id) => systemNames.get(id) ?? `system ${id}`,
		planet: (id) =>
			latest.colonies.find((c) => c.planetId === id)?.name ??
			bodies.get(id) ??
			latest.expansion?.find((e) => e.planetId === id)?.name ??
			latest.anomalies?.find((a) => a.planetId === id)?.planet ??
			`planet ${id}`,
		country: (id) => countryNames.get(id) ?? 'unknown empire'
	};
	return { ctx, names, saves, upcoming };
}

const systemOf = (g: Goal, c: PlanCtx) => KINDS[g.kind]?.system?.(g.target, c) ?? null;

function row(g: Goal, c: Ctx, dates: Map<number, string>): GoalRow {
	const st = check(g.kind, g.target, g.checked, c.ctx);
	const k = KINDS[g.kind];
	const due = dueOf(g.kind, g.target, c.upcoming);
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
		percent: st.state === 'done' ? null : (st.percent ?? null),
		due: due && st.state !== 'done' ? { date: due.date, exact: due.exact } : null,
		waiting: st.waiting ?? false,
		since,
		manual: k?.manual ?? false,
		badge: badgeOf(g.kind, g.target, getGameData()),
		ascension: ascensionOf(g.kind, g.target, getGameData()),
		area: areaOf(g.kind, g.target, getGameData()),
		tint: tintOf(g.kind, g.target, getGameData()),
		dependents: [],
		cost: null,
		added: { ...g.added, date: dates.get(g.added.nodeId) ?? null }
	};
}

/**
 * Fills in each row's cost and times (in the page's order, parked ones last and never in the plan
 * order) and returns the incomes used: this month's net and the mean over the profile's window.
 */
function estimate(snaps: Snapshot[], c: Ctx, list: GoalRow[]) {
	const data = forEmpire(getGameData(), c.ctx.latest);
	const now = snaps.at(-1)!;
	const window = setting('incomeWindow');
	const rates = incomeRates(snaps, window);
	const shipset = c.ctx.latest.shipset;
	const world = {
		latest: { ...c.ctx.latest, stockpile: now.stockpile },
		galaxy: c.ctx.galaxy,
		data,
		bio: shipset ? (data.shipKinds[shipset]?.includes('bio_ship') ?? null) : null
	};
	const storage = storageRows(now.stockpile, now.storageMax, data.resourceInfo);
	const max = Object.fromEntries(storage.map((r) => [r.resource, r.max]));
	const est = costRows(
		list.map((r) => ({
			id: r.id,
			kind: r.kind,
			target: r.target,
			queued: !r.parked && r.polarity !== 'avoid' && r.state !== 'done' && r.state !== 'blocked'
		})),
		world,
		rates,
		max,
		display().planOrder
	);
	for (const r of list)
		if (r.state !== 'done' && r.polarity !== 'avoid') r.cost = est.get(r.id) ?? null;
	return {
		window,
		months: rates.months,
		now: rates.now,
		avg: rates.avg,
		exactStorage: storage.every((r) => r.exact)
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
				typeof d.polarity === 'string' ? d.polarity : 'want',
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
	const { surveyAll } = display();
	for (const ref of refs) {
		const place = /^(outpost|waystation):(\d+)$/.exec(ref);
		if (place) {
			out[ref] = systemInfo(
				c?.ctx.galaxy?.find((x) => x.id === Number(place[2])),
				place[1] as 'outpost' | 'waystation',
				getGameData(),
				c?.ctx.latest.countries ?? [],
				surveyAll
			);
			continue;
		}
		if (ref.startsWith('focusreward:') && c) {
			const key = ref.slice('focusreward:'.length);
			const r = focus.rewards[key];
			if (!r) continue;
			// the research option it gives this empire, explained as the tech tab explains it
			const ours = r.options.filter((o) => c.ctx.possible(o.when) !== false);
			const techExplained =
				ours.length === 1 ? getExplanations()[`tech:${ours[0].tech}`] : undefined;
			out[ref] = {
				title: rewardLabel(key, c.names),
				description: techExplained?.description ?? null,
				modifiers: techExplained?.modifiers ?? [],
				text: 'A research option that stays among your choices until researched.',
				facts: [
					...(r.cost !== null ? [`costs ${r.cost} focus points in its area`] : []),
					...(techExplained?.facts ?? [])
				]
			};
			continue;
		}
		if (!ref.startsWith('focuscard:')) continue;
		const card = focus.cards[ref.slice('focuscard:'.length)];
		if (!card) continue;
		// the area's tier being worked towards, as the game's panel: "20 / 40 to Tier 1 …"
		const next = (category: string) => {
			const now = c?.ctx.latest.focus?.rewards.find((r) => r.category === category);
			if (!now || !c || !focus.rewards[now.current]) return '';
			const cost = focus.rewards[now.current].cost;
			return ` — ${Math.round(now.progress)}${cost !== null ? ` / ${cost}` : ''} to ${rewardLabel(now.current, c.names)}`;
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
						`+${g.amount} ${focus.categories[g.category] ?? g.category} points${next(g.category)}`
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
			(g) => g.kind === kind && !g.parked && wanted(g.polarity) && (kind === 'tech' || !g.auto)
		);
	const techsNeeded = (techs: string[]) =>
		techNeeds(techs, researched, data.techs, data.techRequirements, c.ctx.possible);
	// techs a goal needs, as goals of their own (each with what it needs in turn)
	const rootNeeds = (asked: { tech: string; note: string }[]): AutoGoal[] => {
		const open = asked.filter(
			(a, i) => !researched.includes(a.tech) && asked.findIndex((b) => b.tech === a.tech) === i
		);
		return [
			...open.map(({ tech, note }): AutoGoal => ({
				id: `auto-tech-${tech}`,
				kind: 'tech',
				target: { tech },
				polarity: 'want',
				note
			})),
			...techsNeeded(open.map((a) => a.tech))
		];
	};
	// a planned arkship brings its class's tech
	const arkshipNeeds = (goals: Goal[]) =>
		rootNeeds(
			goals.flatMap((g) => {
				const type = String(g.target.type);
				const tech = ARKSHIP_TECHS[type];
				return tech ? [{ tech, note: `needed for ${ARKSHIPS[type] ?? type}s` }] : [];
			})
		);
	// a planned adoption brings the techs its `possible` asks of this empire (an ascension tree's:
	// Integrated Cybernetics for Cybernetics …), the plan's perks and traditions counted as taken
	const held = new Set([
		...wantedOf('perk').map((g) => String(g.target.perk)),
		...wantedOf('tradition').map((g) => String(g.target.tradition))
	]);
	const adoptTree = new Map(
		Object.values(data.traditionTrees).flatMap((t) => {
			const adopt = t.traditions.find((x) => x.role === 'adopt')?.key;
			return adopt ? [[adopt, t] as const] : [];
		})
	);
	const taken = new Set(c.ctx.latest.traditions ?? []);
	const adoptNeeds = (goals: { kind: string; target: Goal['target'] }[]) =>
		rootNeeds(
			goals.flatMap((g) => {
				const key = String(g.target.tradition);
				const tree = g.kind === 'tradition' && !taken.has(key) ? adoptTree.get(key) : undefined;
				if (!tree) return [];
				return techsAsked(tree.adoptPossible ?? null, c.ctx.possible, held).map((tech) => ({
					tech,
					note: `needed to adopt ${tree.name}`
				}));
			})
		);
	// a path's situation (`ASCENSION_SITUATIONS`), started by a perk or adoption taken or planned,
	// brings what its blocks stop without: techs, traditions, a building on any colony
	const running = new Set((c.ctx.latest.situations ?? []).map((x) => x.type));
	const situationNeeds = (starters: string[]): AutoGoal[] => {
		const out: AutoGoal[] = [];
		const asked: { tech: string; note: string }[] = [];
		for (const key of new Set(
			starters
				.flatMap((k) => ASCENSION_SITUATIONS[k] ?? [])
				.filter(
					// seen and gone: finished
					(x) => running.has(x) || !c.ctx.seen.situations.includes(x)
				)
		))
			for (const block of data.situationBlocks?.[key] ?? []) {
				const needs = blockNeeds(block.when, c.ctx.possible);
				if (!needs) continue;
				const note = `${data.situationTypes[key]?.name ?? key} stops without it${block.text ? ` (“${block.text}”)` : ''}`;
				for (const tech of needs.techs) asked.push({ tech, note });
				for (const tradition of needs.traditions)
					out.push({
						id: `auto-tr-${tradition}`,
						kind: 'tradition',
						target: { tradition },
						polarity: 'want',
						note
					});
				for (const building of needs.buildings)
					out.push({
						id: `auto-bld-${building}`,
						kind: 'building_any',
						target: { building },
						polarity: 'want',
						note
					});
			}
		return [...out, ...rootNeeds(asked)];
	};
	const startersOf = (goals: { kind: string; target: Goal['target'] }[]) => [
		...goals.flatMap((g) =>
			g.kind === 'perk'
				? [String(g.target.perk)]
				: g.kind === 'tradition'
					? [String(g.target.tradition)]
					: []
		)
	];
	// a tree whose adoption the empire could meet once it has the techs that asks for
	const treeAvailable = (key: string) => {
		const tree = data.traditionTrees[key];
		return (
			tree != null &&
			c.ctx.possible(tree.potential ?? null) !== false &&
			c.ctx.possible(tree.adoptPossible ? withTechs(tree.adoptPossible, held) : null) !== false
		);
	};
	// a planned adoption brings its tree, a planned pick its adoption and the picks it needs
	const auto = autoGoals(
		c.ctx.latest,
		data,
		wantedOf('tradition').map((g) => String(g.target.tradition)),
		wantedOf('perk').map((g) => String(g.target.perk)),
		treeAvailable
	);
	const fromTechs = techsNeeded(wantedOf('tech').map((g) => String(g.target.tech)));
	const more = [
		...arkshipNeeds(wantedOf('arkship')),
		...adoptNeeds([...auto, ...wantedOf('tradition')]),
		...situationNeeds([
			...(c.ctx.latest.ascensionPerks ?? []),
			...taken,
			...startersOf([...auto, ...wantedOf('tradition'), ...wantedOf('perk')])
		])
	];
	const needs = [
		...fromTechs,
		...more.filter(
			(g, i) => !fromTechs.some((x) => x.id === g.id) && more.findIndex((x) => x.id === g.id) === i
		)
	];
	const plan = planAt(events, path, [...auto, ...needs]);
	// what each added goal brings by itself
	const fromSave = new Set(saved.map((g) => g.id));
	const brings = [
		...wantedOf('tech'),
		...wantedOf('tradition'),
		...wantedOf('perk'),
		...wantedOf('arkship')
	]
		.filter((g) => !g.auto)
		.map((g): [string, Set<string>] => [
			g.id,
			new Set(
				(g.kind === 'tech'
					? techsNeeded([String(g.target.tech)])
					: g.kind === 'arkship'
						? arkshipNeeds([g])
						: (() => {
								const own = autoGoals(
									c.ctx.latest,
									data,
									g.kind === 'tradition' ? [String(g.target.tradition)] : [],
									g.kind === 'perk' ? [String(g.target.perk)] : [],
									treeAvailable
								);
								return [
									...own,
									...adoptNeeds([...own, g]),
									...situationNeeds(startersOf([...own, g]))
								];
							})()
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
export function plannerPage(snaps: Snapshot[], tip: number, upcoming: Upcoming[] = []) {
	const c = planCtx(snaps, upcoming);
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
				: group === 'focus'
					? orderFocus(list)
					: list
	);
	const others = c ? otherBranches(events, branchesOf(campaign, tip), plan) : [];
	const toRow = (g: Goal) =>
		c ? { ...row(g, c, dates), dependents: dependents[g.id] ?? [] } : null;
	const rows = Object.fromEntries(
		GROUPS.map((g) => [g.id, (groups[g.id] ?? []).map(toRow).filter((r) => r !== null)])
	) as Record<string, GoalRow[]>;
	// the first planned tradition gets the next tradition's unity and due date
	const next = upcoming.find((u) => u.kind === 'tradition');
	const at = nextTradition(rows.traditions ?? [], getGameData());
	if (next && at >= 0)
		rows.traditions[at] = {
			...rows.traditions[at],
			percent: share(next.done ?? 0, next.total) ?? null,
			due: { date: next.date, exact: next.exact }
		};
	const parkedRows = parked(plan)
		.map(toRow)
		.filter((r) => r !== null);
	const income = c
		? estimate(snaps, c, [...GROUPS.flatMap((g) => rows[g.id]), ...parkedRows])
		: null;
	// labels for the history, from every goal ever added on this branch
	// what each history entry is about, for its label and badges: every goal ever added on this
	// branch, and the automatic ones (they have no add of their own)
	type About = {
		label: string;
		kind: string;
		badge: string | null;
		ascension: boolean;
		area: string | null;
		tint: string | null;
		group: string;
		ref: string | null; // its popup, fetched on hover (`/api/explain`): only the game data's cards
	};
	const labels = new Map<string, About>();
	const staticRef = (kind: string, target: Target) => {
		const r = KINDS[kind]?.ref?.(target) ?? null;
		return r && getExplanations()[r] ? r : null;
	};
	const about = (kind: string, target: Target, title: string): About | null =>
		c
			? {
					label: label(kind, target, title, c.names),
					kind,
					badge: badgeOf(kind, target, getGameData()),
					ascension: ascensionOf(kind, target, getGameData()),
					area: areaOf(kind, target, getGameData()),
					tint: tintOf(kind, target, getGameData()),
					group: GROUPS.find((g) => g.id === groupOf(kind))?.name ?? '',
					ref: staticRef(kind, target)
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
	const shortcutList = c ? shortcuts(c, plan) : [];
	const otherRows = c ? others.map((g) => ({ ...row(g, c, dates), tips: g.tips })) : [];
	return {
		groups: GROUPS.map((g) => ({ ...g, goals: rows[g.id] })),
		income,
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
				ascension: labels.get(e.goal)?.ascension ?? false,
				area: labels.get(e.goal)?.area ?? null,
				tint: labels.get(e.goal)?.tint ?? null,
				ref: labels.get(e.goal)?.ref ?? null,
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
				ascension: r.ascension,
				area: r.area,
				tint: r.tint,
				ref: r.ref,
				group: GROUPS.find((g) => g.id === r.group)?.name ?? null
			})),
		suggestions: suggested,
		shortcuts: shortcutList,
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
			[...all, ...otherRows, ...suggested, ...shortcutList.flatMap((s) => s.techs)]
				.map((r) => r.ref ?? null)
				.filter((r) => r !== null),
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
		reward: Object.keys(d.focus.rewards)
			.sort(
				(a, b) =>
					(d.focus.rewards[a].category ?? '').localeCompare(d.focus.rewards[b].category ?? '') ||
					rewardIndex(a) - rewardIndex(b)
			)
			.map((k) => ({ value: k, label: rewardLabel(k, names) })),
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

/** The tech shortcuts (#lib/planner/shortcuts.ts): per bundle, the techs still open to plan. */
function shortcuts(c: Ctx, plan: Plan) {
	const have = new Set([...plan.goals.values()].map((g) => goalKey(g.kind, g.target, g.title)));
	const data = getGameData();
	return shortcutRows(
		SHORTCUTS,
		(tech) => have.has(goalKey('tech', { tech })),
		(tech) => {
			const target = { tech };
			if (!data.techs[tech]) return null; // not in this game version's data
			if (check('tech', target, false, c.ctx).state !== 'open') return null;
			return {
				kind: 'tech',
				target,
				label: label('tech', target, '', c.names),
				ref: KINDS.tech.ref?.(target) ?? null,
				badge: badgeOf('tech', target, data),
				area: areaOf('tech', target, data),
				tint: tintOf('tech', target, data)
			};
		},
		nomadic(c.ctx.latest)
	);
}

const LIMIT = 12;

/** Goals worth planning, per group, from what the save shows (none already in the plan). */
function suggestions(c: Ctx, plan: Plan): Suggestion[] {
	const { ctx, names } = c;
	const have = new Set([...plan.goals.values()].map((g) => goalKey(g.kind, g.target, g.title)));
	const out: Suggestion[] = [];
	const plannedTraditionLabels = new Set(
		[...plan.goals.values()]
			.filter((g) => g.kind === 'tradition')
			.map((g) => label('tradition', g.target, g.title ?? '', names))
	);
	const off = unavailable(ctx.latest);
	const add = (
		kind: string,
		list: { target: Target; why?: string; tip?: string | null; unavailable?: boolean }[]
	) => {
		if (off.includes(kind)) return;
		let n = 0;
		for (const x of list) {
			if (n >= suggestionLimit(kind, LIMIT)) break;
			const itemLabel = label(kind, x.target, '', names);
			if (have.has(goalKey(kind, x.target))) continue;
			if (
				kind === 'tradition' &&
				ascensionOf(kind, x.target, d) &&
				plannedTraditionLabels.has(itemLabel)
			)
				continue;
			const status = check(kind, x.target, false, ctx);
			if (status.state === 'done' || !suggestionVisible(kind, status.state)) continue;
			out.push({
				kind,
				target: x.target,
				label: label(kind, x.target, '', names),
				why: x.why,
				tip: x.tip ?? null,
				unavailable: x.unavailable,
				ref: KINDS[kind]?.ref?.(x.target) ?? null,
				badge: badgeOf(kind, x.target, getGameData()),
				ascension: ascensionOf(kind, x.target, getGameData()),
				area: areaOf(kind, x.target, getGameData()),
				tint: tintOf(kind, x.target, getGameData())
			});
			if (kind === 'tradition' && ascensionOf(kind, x.target, d))
				plannedTraditionLabels.add(itemLabel);
			n++;
		}
	};
	const l = ctx.latest;
	const d = ctx.data;
	const all = getGameData();
	const tips = outcomeTips(all, display(), outcomeNow(l, all));
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
			why: d.anomalyCategories[a.category]?.name,
			tip: tips.anomaly(a.category)
		}))
	);
	add(
		'digsite',
		(l.digSites ?? []).map((x) => ({
			target: { planet: x.planetId },
			why: `${all.digSiteTypes[x.type]?.name ?? pretty(x.type.replace(/^site_/, ''))}, difficulty ${x.difficulty}`,
			tip: tips.digSite(x.type, x.chapter ?? null)
		}))
	);
	add(
		'wanderlust',
		// the ones we can finish with what we found first
		(l.wanderlust ? outlook(l.wanderlust, ctx.galaxy ?? []) : [])
			.filter((x) => x.need > 0)
			.sort((a, b) => Number(b.finishable) - Number(a.finishable))
			.map((x) => ({
				target: { category: x.key },
				why: `${x.seen} of ${x.count}, ${x.open} found${x.finishable ? ': enough to finish' : ''}`
			}))
	);
	add(
		'outpost',
		(ctx.galaxy ?? [])
			.filter((s) => s.visited && !s.owned && s.ownerId === null)
			.map((s) => ({ target: { system: s.id } }))
	);
	// read once: display() reads the profile and every node, and this runs per body (8155 on
	// Roaming Korinth's galaxy — ~15 min of display() before 2026-11-06)
	const { surveyAll } = display();
	add(
		'waystation',
		(ctx.galaxy ?? [])
			.filter((x) => x.bodies && !ctx.latest.stations?.some((st) => st.systemId === x.id))
			.map((x) => ({
				x,
				n: x.bodies!.reduce(
					(a, b) =>
						a +
						(surveyAll || b.surveyed !== false ? b.deposits : []).filter((dep) =>
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
	const treeState = (tree: (typeof d.traditionTrees)[string]) => {
		const potential = ctx.possible(tree.potential ?? null);
		const adopt = ctx.possible(tree.adoptPossible ?? null);
		return potential === false || adopt === false
			? false
			: potential === null || adopt === null
				? null
				: true;
	};
	const treeChoices = Object.values(d.traditionTrees).filter((tree) => tree.ascension);
	const treeByName = new Map<string, (typeof treeChoices)[number]>();
	for (const tree of treeChoices) {
		const previous = treeByName.get(tree.name);
		const rank = (x: (typeof treeChoices)[number]) => {
			if (x.traditions.some((t) => t.role === 'adopt' && taken.has(t.key))) return 3;
			const state = treeState(x);
			return state === true ? 2 : state === null ? 1 : 0;
		};
		if (!previous || rank(tree) > rank(previous)) treeByName.set(tree.name, tree);
	}
	add(
		'tradition',
		Object.values(d.traditionTrees).flatMap((tree) => {
			const adopted = tree.traditions.some((t) => t.role === 'adopt' && taken.has(t.key));
			const isAscension = Boolean(tree.ascension);
			if (isAscension && treeByName.get(tree.name) !== tree) return [];
			return tree.traditions
				.filter(
					(t) =>
						(adopted ? t.role !== 'adopt' && t.role !== 'finish' : t.role === 'adopt') &&
						!taken.has(t.key)
				)
				.map((t) => {
					const unavailable = isAscension && !adopted && treeState(tree) === false;
					return {
						target: { tradition: t.key },
						why: unavailable ? `${tree.name} · not currently available` : tree.name,
						...(isAscension && !adopted ? { unavailable } : {})
					};
				});
		})
	);
	add(
		'perk',
		uniquePerks(Object.keys(d.perks), d.perks, (key) =>
			c.ctx.possible(d.perkRules[key]?.potential ?? null)
		)
			.filter((k) => !(l.ascensionPerks ?? []).includes(k))
			.map((k) => ({ target: { perk: k } }))
	);
	// each area's next rewards, from the one being worked towards
	add(
		'focus_reward',
		(l.focus?.rewards ?? []).flatMap((now) =>
			Object.keys(d.focus.rewards)
				.filter(
					(k) =>
						d.focus.rewards[k].category === now.category &&
						rewardIndex(k) >= rewardIndex(now.current)
				)
				.sort((a, b) => rewardIndex(a) - rewardIndex(b))
				.slice(0, 4)
				.map((k) => ({ target: { reward: k } }))
		)
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
	// a target the arkship has not counted yet, for a category not done (it counts for one only);
	// in a system not visited only with the spoiler ("Map: every Wanderlust target")
	const w = ctx.latest.wanderlust;
	const known = s?.visited || s?.owned || display().wanderlustAll;
	const key = known ? countsFor(s?.wanderlust ?? []) : null;
	const cat = w?.categories.find((x) => x.key === key);
	if (w && key && !w.complete && !cat?.done && !counted(w, systemId))
		out.push({
			kind: 'wanderlust_visit',
			target: { system: systemId },
			why: wanderlustName(key)
		});
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

type Summary = {
	keys: string[];
	ids: Record<string, string>; // goal key → its goal's id, so a "+ goal" button can take it out

	alerts: number;
	unavailable: string[];
	// for `plannedOnOffer()`, and the tech tree's want buttons (`goal`: its id, to edit or remove)
	plannedTechs: [string, { stance: Stance; note: string; goal: string }][];
};

let memo: { key: string; value: Summary } | null = null;

/**
 * For the tab bar and the "+ goal" buttons on every page: the plan's goal keys at the node shown,
 * and how many need attention — blocked, or avoided and happened; for the upcoming list the techs
 * planned, each with its stance (wanted ones' prerequisites included). Cached by tip and plan.
 */
export function planSummary(tip: number | null): Summary {
	const none: Summary = { keys: [], ids: {}, alerts: 0, unavailable: [], plannedTechs: [] };
	if (tip === null) return none;
	const db = getDb();
	const node = nodeById(db, tip);
	if (!node) return none;
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
				if (st === 'blocked' && wanted(g.polarity)) alerts++;
				if (st === 'done' && g.polarity === 'avoid') alerts++;
			}
	}
	memo = {
		key,
		value: {
			keys: goals.map((g) => goalKey(g.kind, g.target, g.title)),
			ids: Object.fromEntries(goals.map((g) => [goalKey(g.kind, g.target, g.title), g.id])),
			alerts,
			unavailable: c ? unavailable(c.ctx.latest) : [],
			plannedTechs: goals
				.filter((g) => g.kind === 'tech' && !g.parked)
				.map((g) => [String(g.target.tech), { stance: g.polarity, note: g.note, goal: g.id }])
		}
	};
	return memo.value;
}
