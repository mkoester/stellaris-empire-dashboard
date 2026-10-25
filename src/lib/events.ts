import { idleState, monthsLeft, orderLabel, orderRate } from './ships.ts';
import type { QueueItem, Snapshot } from './types.ts';

// Upcoming events of the empire: when current research, the next tradition, the council agenda,
// queued construction and the next election are due. Pure; the page shows them as one list.
//
// Rates are measured, not computed: progress between saves of the branch, so every speed bonus is
// included (research and agendas per month start, as both arrive monthly). Costs are base costs from the game data scaled by what the save knows
// (empire size, galaxy cost sliders) — other cost modifiers are unknown, hence "estimated".

import { pretty } from './format.ts';
import type { ActionKind, Colony, GameData, TimedModifier } from './types.ts';
export type { GameData };

export type Upcoming = {
	date: string; // when it is due, "2200.09.01"
	months: number; // from the snapshot's date
	kind:
		| 'research'
		| 'tradition'
		| 'agenda'
		| 'construction'
		| 'shipyard'
		| 'ship'
		| 'colonization'
		| 'election'
		| 'deficit'
		| 'cooldown' // something may be done again
		| 'expires'; // a timed effect ends
	what: string;
	detail: string;
	exact: boolean; // false: estimated from costs the save does not hold
	tint: string; // color key (#lib/colors.ts): the resource or research field it is about
	ref?: string; // explanation id (`tech:…`, `agenda:…`) for a popup
	done?: number; // progress so far, and what is needed, where it is a progress bar
	total?: number;
	planetId?: number;
	// true: a build slot runs idle then — the one case the game sends no notification for (research,
	// traditions, agendas and elections it announces itself)
	act: boolean;
	queuedAfter?: number; // construction: items still waiting when this one is done
	fleetId?: number; // civilian ship rows
	sub?: string; // what to show as the kind, where finer than `kind` (ships: the ship type)
};

/**
 * Tech costs in game are × (1 + 0.05 × tier) of the base cost, rounded down (4.5.2, technology
 * slider 1, empire size ≤ 100): tier 1 1575 / 1312 / 1050 for 1500 / 1250 / 1000, tier 2 2200 for
 * 2000 and 2750 for 2500, rare or not (Planetforgers 2212.03.05, screenshots 2026_10_22_19–21).
 * Source unconfirmed — no define names it.
 */
export const techCostFactor = (tier: number | null) => 1 + 0.05 * (tier ?? 1);

// ── Game calendar: 12 months of 30 days ────────────────────────────────────

export function toDays(date: string): number {
	const [y, m, d] = date.split('.').map(Number);
	return (y * 12 + m - 1) * 30 + d - 1;
}

/** Days → "2207.03.13". Rounds: progress in the save can be fractional (117.12 of 120 days). */
export function fromDays(fractionalDays: number): string {
	const days = Math.round(fractionalDays);
	const months = Math.floor(days / 30);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${Math.floor(months / 12)}.${pad((months % 12) + 1)}.${pad((days % 30) + 1)}`;
}

const monthsBetween = (a: string, b: string) => (toDays(b) - toDays(a)) / 30;

// ── Costs ───────────────────────────────────────────────────────────────────

const sizePenalty = (size: number | null, perSize: number | undefined, d: GameData['defines']) =>
	1 + Math.max((size ?? 0) - (d.EMPIRE_SIZE_BASE ?? 100), 0) * (perSize ?? 0);

/** Per the defines: [base + (perTradition·taken)^exp] · size penalty · galaxy slider. */
export function traditionCost(
	taken: number,
	size: number | null,
	setting: number,
	d: GameData['defines']
) {
	const base =
		(d.TRADITION_COST_AMOUNTS ?? 300) +
		((d.TRADITION_COST_TRADITION ?? 8) * taken) ** (d.TRADITION_COST_TRADITION_EXP ?? 1.8);
	// rounded up: 3 taken → 605.06, the game's tooltip 300 + 306 (2026-10-19)
	return Math.ceil(base * sizePenalty(size, d.EMPIRE_SIZE_TRADITION_COST_PENALTY, d) * setting);
}

// ── Events ──────────────────────────────────────────────────────────────────

/** Due after `remaining` at `rate` per month, rounded up to whole months like the game shows. */
function due(
	now: string,
	remaining: number,
	rate: number
): { date: string; months: number } | null {
	if (remaining <= 0) return { date: now, months: 0 };
	if (!(rate > 0)) return null;
	const months = Math.ceil(remaining / rate);
	return { date: fromDays(toDays(now) + months * 30), months };
}

/**
 * When each queue item is done, with `slots` built at once in queue order: an item starts when a
 * slot frees. `waitingAfter`: items not yet started when it is done — 0 means its slot then idles.
 */
export function scheduleQueue(items: { progress: number; needed: number }[], slots: number) {
	const free = Array<number>(Math.max(slots, 1)).fill(0); // day each slot is free again
	const plan = items.map((item) => {
		const slot = free.indexOf(Math.min(...free));
		const start = free[slot];
		free[slot] = start + Math.max(item.needed - item.progress, 0);
		return { start, doneIn: free[slot], startsNow: start === 0 };
	});
	return plan.map((p) => ({
		...p,
		waitingAfter: plan.filter((q) => q.start >= p.doneIn && q !== p).length
	}));
}

/**
 * One event per queue item: due when its slot gets to it, ⚠ (`act`) when nothing waits for the
 * slot afterwards, `queuedAfter` counting what still waits.
 */
function queueEvents(
	date: string,
	queue: QueueItem[],
	slots: number,
	kind: 'construction' | 'shipyard',
	describe: (item: QueueItem) => Pick<Upcoming, 'what' | 'detail' | 'planetId'>
): Upcoming[] {
	const plan = scheduleQueue(queue, slots);
	return queue.map((item, i) => ({
		date: fromDays(toDays(date) + plan[i].doneIn),
		months: plan[i].doneIn / 30,
		kind,
		tint: 'construction',
		exact: plan[i].startsNow,
		act: plan[i].waitingAfter === 0,
		queuedAfter: plan[i].waitingAfter,
		...describe(item)
	}));
}

const fmt = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 0 });

/** Month starts passed from one date to another — when monthly-ticking values change. */
export const monthTicks = (from: string, to: string) => {
	const index = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
	return index(to) - index(from);
};

/**
 * A tech's progress per month, or null without two saves to measure it. Research arrives once a
 * month, after the autosave on the 1st (Planetforgers 2212.03.01 → 03.05: society +34.8, exactly
 * the month's 24.7 × 1.41; the game's own tooltip: "+168.07 progress/month"), so a short window
 * holds a whole month's chunk or none. Measured from the latest earlier save with a chunk between,
 * per chunk.
 */
export function researchRate(tech: string, latest: Snapshot, earlier: Snapshot[]): number | null {
	const at = (s: Snapshot) => s.progress?.research.find((x) => x.tech === tech)?.progress;
	const now = at(latest);
	const base = earlier.findLast(
		(s) => at(s) !== undefined && researchTicks(s.date, latest.date) >= 1
	);
	return now === undefined || !base
		? null
		: (now - at(base)!) / researchTicks(base.date, latest.date);
}

/** Monthly research chunks between two saves: an autosave on the 1st still precedes its month's. */
export const researchTicks = (from: string, to: string) => {
	const period = (d: string) =>
		Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - (d.endsWith('.01') ? 1 : 0);
	return period(to) - period(from);
};

/**
 * `latest` is the state shown; `previous` the save before it on the same branch (for daily rates),
 * `earlier` all its saves before `latest` (for monthly ones). Sorted by due date.
 */
export function upcoming(
	latest: Snapshot,
	previous: Snapshot | null,
	data: GameData,
	earlier: Snapshot[] = previous ? [previous] : []
): Upcoming[] {
	const p = latest.progress;
	if (!p) return [];
	const out: Upcoming[] = [];
	const elapsed = previous?.progress ? monthsBetween(previous.date, latest.date) : 0;
	const d = data.defines;

	for (const r of p.research) {
		const tech = data.techs[r.tech];
		if (!tech?.cost) continue;
		const cost = Math.floor(
			tech.cost *
				p.costSettings.technology *
				sizePenalty(latest.empireSize, d.EMPIRE_SIZE_TECH_COST_PENALTY, d) *
				techCostFactor(tech.tier) +
				1e-9
		);
		const rate =
			researchRate(r.tech, latest, earlier) ?? latest.income?.[`${r.area}_research`] ?? 0;
		const when = due(latest.date, cost - r.progress, rate);
		if (when)
			out.push({
				...when,
				kind: 'research',
				act: false,
				what: tech.name,
				tint: `${r.area}_research`,
				ref: `tech:${r.tech}`,
				done: r.progress,
				total: cost,
				detail: `${r.area} · ${fmt(r.progress)} / ${fmt(cost)} · +${rate.toFixed(1)}/month`,
				exact: false
			});
	}

	const unity = latest.stockpile.unity ?? 0;
	const unityRate = latest.balance.unity ?? 0;
	const tradition = traditionCost(
		p.traditionsTaken,
		latest.empireSize,
		p.costSettings.traditions,
		d
	);
	const tWhen = due(latest.date, tradition - unity, unityRate);
	if (tWhen)
		out.push({
			...tWhen,
			kind: 'tradition',
			act: false,
			what: 'Next tradition',
			tint: 'unity',
			done: unity,
			total: tradition,
			detail: `unity ${fmt(unity)} / ${fmt(tradition)} · +${unityRate.toFixed(1)}/month`,
			exact: false
		});

	const agenda = p.agenda && data.agendas[p.agenda.key];
	if (p.agenda && agenda?.cost) {
		const cost =
			agenda.cost * sizePenalty(latest.empireSize, d.EMPIRE_SIZE_COUNCIL_AGENDA_COST_PENALTY, d);
		// Agenda progress moves on the 1st only (2207.02.01 → 03.01: +44, 03.01 → 03.10: 0), so the
		// rate comes from the last save before a month start, per month start passed.
		const key = p.agenda.key;
		const base = earlier.findLast(
			(s) => s.progress?.agenda?.key === key && monthTicks(s.date, latest.date) >= 1
		);
		const rate = base
			? (p.agenda.progress - base.progress!.agenda!.progress) / monthTicks(base.date, latest.date)
			: 0;
		const when = due(latest.date, cost - p.agenda.progress, rate);
		if (when)
			out.push({
				...when,
				kind: 'agenda',
				act: false,
				what: agenda.name,
				tint: 'agenda',
				ref: `agenda:${p.agenda.key}`,
				done: p.agenda.progress,
				total: cost,
				detail: `council agenda · ${fmt(p.agenda.progress)} / ${fmt(cost)} · +${rate.toFixed(1)}/month`,
				exact: false
			});
	}

	// Launched agendas: when each can be picked again (the save's own date, exact).
	for (const c of latest.agendaCooldowns ?? [])
		if (c.until > latest.date)
			out.push({
				date: c.until,
				months: Math.max(0, Math.round(monthsBetween(latest.date, c.until))),
				kind: 'agenda',
				act: false,
				what: data.agendas[c.key]?.name ?? c.key,
				tint: 'agenda',
				ref: `agenda:${c.key}`,
				detail: 'council agenda · can be picked again',
				exact: true
			});

	// Build queues: progress counts days. A planet builds `buildSlots` items at once; the rest wait.
	for (const c of latest.colonies)
		out.push(
			...queueEvents(latest.date, c.buildQueue, c.buildSlots, 'construction', (item) => ({
				what: item.name,
				detail: `${c.name} · ${item.kind.replaceAll('_', ' ')}`,
				planetId: c.planetId
			}))
		);

	// Colonies being settled: done at COLONY_POPS_REQUIRED (100) pops, growing COLONY_MONTHLY_GROWTH
	// (3) a month before modifiers — measured from the save before when it shows the colony too.
	for (const c of latest.colonies.filter((c) => c.colonizing)) {
		const before = previous?.colonies.find((p) => p.planetId === c.planetId && p.colonizing);
		const rate = before && elapsed > 0 ? (c.pops - before.pops) / elapsed : 3;
		if (!(rate > 0)) continue;
		const when = due(latest.date, 100 - c.pops, rate);
		if (when)
			out.push({
				...when,
				kind: 'colonization',
				what: c.name,
				tint: 'colonization',
				detail: `${fmt(c.pops)} / 100 colonists · +${rate.toFixed(1)}/month${before ? '' : ' (base rate)'}`,
				exact: false,
				act: false, // the game announces a finished colony
				planetId: c.planetId
			});
	}

	// Civilian ships, by the same rules: ⚠ when nothing is queued after the current order; an idle
	// ship is due now.
	for (const s of latest.civilianShips ?? []) {
		const left = monthsLeft(s, orderRate(s, previous, elapsed), data.anomalyLevels);
		if (left === null) continue;
		const days = Math.round(left * 30);
		out.push({
			date: fromDays(toDays(latest.date) + days),
			months: days / 30,
			kind: 'ship',
			sub: s.kind.replaceAll('_', ' '),
			what: s.order ? orderLabel(s.order) : idleState(s).text,
			tint: 'ship',
			detail: `${s.name} · ${s.kind.replaceAll('_', ' ')}`,
			exact: s.order === null,
			// an idle ship has no queue to count; whether it needs the player depends on where it waits
			act: s.automation ? false : s.order ? s.queue.length === 0 : idleState(s).act,
			queuedAfter: s.order ? s.queue.length : undefined,
			fleetId: s.fleetId
		});
	}

	// Shipyards, by the same rules: a starbase's ship queue, and a Mega Shipyard's when found.
	const ship = (item: QueueItem) => ({
		what: `${item.name.replaceAll('_', ' ')}${item.design ? ` "${item.design}"` : ''}`
	});
	for (const s of latest.stations ?? [])
		if (s.shipyard)
			out.push(
				...queueEvents(latest.date, s.shipyard.queue, s.shipyard.slots, 'shipyard', (item) => ({
					...ship(item),
					detail: `${s.system} ${s.level}`
				}))
			);
	for (const m of latest.megaShipyards ?? [])
		if (m.queue)
			out.push(
				...queueEvents(latest.date, m.queue, m.slots, 'shipyard', (item) => ({
					...ship(item),
					detail: `${m.system} Mega Shipyard`
				}))
			);

	if (p.nextElection && toDays(p.nextElection) >= toDays(latest.date))
		out.push({
			date: p.nextElection,
			months: monthsBetween(latest.date, p.nextElection),
			kind: 'election',
			act: false,
			what: 'Election',
			tint: 'election',
			detail: '',
			exact: true
		});

	out.push(...deficits(latest));

	return out.sort((a, b) => toDays(a.date) - toDays(b.date) || a.what.localeCompare(b.what));
}

/**
 * When a stockpile runs empty at its current monthly balance — the game then applies its
 * `<resource>_deficit` modifier (4.5.2 `common/static_modifiers/09_static_modifiers_deficit.txt`)
 * and does not warn ahead. The save then simply lacks the resource in the stockpile; the modifier
 * is not stored (2210.02.01: energy, only `timeline_first_deficit` in `country.timeline_events`).
 * Research has no stockpile; balances under 0.01 are noise.
 */
export function deficits(latest: Pick<Snapshot, 'date' | 'stockpile' | 'balance'>): Upcoming[] {
	return Object.entries(latest.balance ?? {}).flatMap(([resource, balance]) => {
		if (!(balance < -0.01) || resource.endsWith('_research')) return [];
		const stock = latest.stockpile[resource] ?? 0;
		const when = due(latest.date, stock, -balance);
		if (!when) return [];
		return [
			{
				...when,
				kind: 'deficit' as const,
				act: true,
				what:
					stock > 0
						? `${resource.replaceAll('_', ' ')} runs out`
						: `${resource.replaceAll('_', ' ')} in deficit`,
				tint: resource,
				// what the shortage does: the static modifier (4.5.2: energy's has no effects at all)
				ref: `modifier:${resource}_deficit`,
				detail: `${fmt(stock)} left · ${balance.toFixed(1)}/month`,
				exact: true
			}
		];
	});
}

const ACTION_KINDS: Record<ActionKind, string> = {
	decision: 'decision',
	artifact_action: 'artifact action',
	astral_action: 'astral action',
	enclave: 'enclave'
};

/** "A, B, C +2 more" */
const listed = (names: string[], max = 3) =>
	names.slice(0, max).join(', ') + (names.length > max ? ` +${names.length - max} more` : '');

/**
 * Everything that ends on a date the save holds: timed modifiers and timed flags on the empire
 * and its colonies, edicts with an end, trade deals, the Galactic Community's recess, and when a
 * government reform or a focus change is possible again. A timer an action waits on (data DB
 * `action_timer`: decisions, artifact and astral actions, enclave deals) is a `cooldown` row
 * naming what becomes available — the game does not announce that (`act`); the rest are
 * `expires` rows. A timed flag no action names is an event's internal timer (`curator_clue_purchased`:
 * 10–13 years at random) — a spoiler, only with `hiddenTimers`. All exact: the save's own dates.
 * `title`: a popup's title (`modifier:<key>`, `edict:<key>`).
 */
export function expiries(
	latest: Pick<
		Snapshot,
		| 'date'
		| 'colonies'
		| 'countryModifiers'
		| 'countryTimedFlags'
		| 'cooldowns'
		| 'edictTimes'
		| 'tradeDeals'
		| 'galcom'
	>,
	data: Pick<GameData, 'actionTimers'>,
	title: (ref: string) => string | undefined = () => undefined,
	hiddenTimers = false
): Upcoming[] {
	const now = latest.date;
	const row = (date: string, r: Omit<Upcoming, 'date' | 'months' | 'exact'>): Upcoming => ({
		date,
		months: Math.max(0, monthsBetween(now, date)),
		exact: true,
		...r
	});
	const out: Upcoming[] = [];

	type Timer = TimedModifier & { kind: 'modifier' | 'flag'; colony?: Colony };
	const timers: Timer[] = [
		...(latest.countryModifiers ?? []).map((m) => ({ ...m, kind: 'modifier' as const })),
		...(latest.countryTimedFlags ?? []).map((m) => ({ ...m, kind: 'flag' as const })),
		...latest.colonies.flatMap((colony) => [
			...(colony.planet?.modifiers ?? []).map((m) => ({ ...m, kind: 'modifier' as const, colony })),
			...colony.timedFlags.map((m) => ({ ...m, kind: 'flag' as const, colony }))
		])
	];
	for (const t of timers) {
		// sdash_*: the companion mod's own (its daily tick)
		if (!t.until || t.until <= now || t.key.startsWith('sdash_')) continue;
		const actions = data.actionTimers[`${t.kind}:${t.key}`] ?? [];
		const waiting = [...new Set(actions.filter((a) => a.cooldown).map((a) => a.name))];
		const from = [...new Set(actions.filter((a) => !a.cooldown).map((a) => a.name))];
		if (t.kind === 'flag' && actions.length === 0 && !hiddenTimers) continue;
		const where = t.colony ? `${t.colony.name} · ` : '';
		const name =
			t.kind === 'modifier'
				? (title(`modifier:${t.key}`) ?? pretty(t.key))
				: (waiting[0] ?? from[0] ?? pretty(t.key));
		const sub = actions[0]
			? ACTION_KINDS[actions[0].kind]
			: t.kind === 'flag'
				? 'timer'
				: undefined;
		out.push(
			row(t.until, {
				kind: waiting.length ? 'cooldown' : 'expires',
				sub,
				what: waiting.length
					? `${t.kind === 'modifier' ? listed(waiting) : name} available again`
					: `${name} ends`,
				detail:
					where +
					(waiting.length
						? t.kind === 'modifier'
							? name
							: listed(waiting.slice(1)) || 'cooldown'
						: from.length
							? `from ${listed(from)}`
							: t.kind === 'flag'
								? 'event timer (spoiler)'
								: ''),
				tint: waiting.length ? 'cooldown' : 'expires',
				ref: t.kind === 'modifier' ? `modifier:${t.key}` : undefined,
				act: waiting.length > 0,
				planetId: t.colony?.planetId
			})
		);
	}

	const c = latest.cooldowns;
	// The reform date is the save's `government_date` read as "possible from" — not yet checked in
	// game (2026-10-25: two campaigns both read 2220.07.21), so it is marked estimated.
	const again: [string | null | undefined, string, string, boolean][] = [
		[c?.reform, 'Government reform', 'government · not yet checked in game', false],
		[c?.focusDismiss, 'Dismiss a focus card', 'focus', true],
		[c?.focusChange, 'Change the focus priority', 'focus', true]
	];
	for (const [date, what, detail, exact] of again)
		if (date && date > now)
			out.push({
				...row(date, {
					kind: 'cooldown',
					what: `${what} possible`,
					detail,
					tint: 'cooldown',
					act: true
				}),
				exact
			});

	for (const e of latest.edictTimes ?? [])
		if (e.end && e.end > now)
			out.push(
				row(e.end, {
					kind: 'expires',
					sub: 'edict',
					what: `${title(`edict:${e.key}`) ?? pretty(e.key)} ends`,
					detail: 'edict',
					tint: 'expires',
					ref: `edict:${e.key}`,
					act: false
				})
			);

	for (const d of latest.tradeDeals ?? []) {
		if (!d.start || d.years === null) continue;
		const end = fromDays(toDays(d.start) + d.years * 360);
		if (end > now)
			out.push(
				row(end, {
					kind: 'expires',
					sub: 'trade deal',
					what: `Trade deal with ${d.partner} ends`,
					detail: `${d.years} years from ${d.start}`,
					tint: 'trade-deal',
					act: false
				})
			);
	}

	const recess = latest.galcom?.nextVote;
	if (recess && recess > now)
		out.push(
			row(recess, {
				kind: 'expires',
				sub: 'galcom',
				what: 'Galactic Community recess ends',
				detail: 'the next resolution goes to the vote',
				tint: 'galcom',
				act: false
			})
		);

	return out;
}
