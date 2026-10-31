import {
	NOMAD_ECONOMY,
	nextStage,
	RESERVES,
	reserves,
	withReserves,
	type Reserves
} from './nomad.ts';
import {
	DEFAULT_DAYS_PER_JUMP,
	daysPerJump,
	estimateMonthsLeft,
	idleState,
	measuredDaysPerJump,
	monthsLeft,
	orderLabel,
	orderRate
} from './ships.ts';
import type { Progress, QueueItem, Snapshot } from './types.ts';

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
		| 'leaders' // the recruitable leaders are replaced
		| 'deficit'
		| 'cooldown' // something may be done again
		| 'expires' // a timed effect ends
		| 'roll' // an envoy's or excavation's next roll
		| 'fleet'; // a military fleet arrives
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
	dismiss?: string; // a cooldown that has run out: the id to dismiss it by (`timedOut()`)
};

// The galaxy setting "Difficulty Adjusted Technology Costs" (`technology_difficulty_scale`): "how
// much the selected Difficulty affects the research cost … a greater effect on more advanced
// technologies" (localisation FE_TECH_SPEED_DIFFICULTY_SCALE_TOOLTIP). Its steps and the ranks of the
// difficulties: Normal = 2, cadet = 1, admiral = 5 fit both games measured (below); the others are
// assumed, in order.
const TECH_DIFFICULTY_SCALE: Record<string, number> = {
	scaling_off: 0,
	scaling_low: 1,
	scaling_normal: 2,
	scaling_high: 3
};
export const DIFFICULTY_RANK: Record<string, number> = {
	civilian: 0,
	cadet: 1,
	ensign: 2,
	captain: 3,
	commodore: 4,
	admiral: 5,
	grand_admiral: 6
};

/** A difficulty as the game names it, with its place: `admiral` → "Admiral (6/7)". */
export function difficultyLabel(difficulty: string): string {
	const rank = DIFFICULTY_RANK[difficulty];
	const name = difficulty.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const levels = Object.keys(DIFFICULTY_RANK).length;
	return rank === undefined ? name : `${name} (${rank + 1}/${levels})`;
}

/**
 * Tech costs in game are × (1 + `TECH_COST_DIFFICULTY_SCALE_MULT` (0.025) × scale step × difficulty
 * rank × tier) of the base cost, rounded down (technology slider 1, empire size ≤ 100). Measured:
 * cadet, Normal — tier 1 1575 / 1312 / 1050 for 1500 / 1250 / 1000, tier 2 2200 for 2000 and 2750
 * for 2500, rare or not (Planetforgers 2212.03.05, 4.5.2, screenshots 2026_10_22_19–21); admiral,
 * Normal — tier 1 1875 for 1500 (Roaming Korinth 2204.11, 4.5.3, screenshot
 * 2026-10-31_03-07-59). Settings the save did not tell (before READER 32): cadet's, as before.
 */
export function techCostFactor(
	tier: number | null,
	settings: Progress['costSettings'] | null = null,
	mult = 0.025
): number {
	const scale = TECH_DIFFICULTY_SCALE[settings?.techDifficultyScale ?? ''];
	const rank = DIFFICULTY_RANK[settings?.difficulty ?? ''];
	const perTier = scale === undefined || rank === undefined ? 0.05 : mult * scale * rank;
	return 1 + perTier * (tier ?? 1);
}

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
				techCostFactor(tech.tier, p.costSettings, d.TECH_COST_DIFFICULTY_SCALE_MULT) +
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
	// On its last order a ship always shows: where the save gives no rate, ≈ the order's days at
	// the base rate, else its travel at the measured days per jump.
	const perJump = measuredDaysPerJump(latest, previous, elapsed * 30);
	for (const s of latest.civilianShips ?? []) {
		let left = monthsLeft(s, orderRate(s, previous, elapsed), data.anomalyLevels);
		let estimated = false;
		if (left === null && s.order && s.queue.length === 0) {
			left = estimateMonthsLeft(s, data.anomalyLevels, perJump ?? DEFAULT_DAYS_PER_JUMP);
			estimated = true;
		}
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
			exact: s.order === null && !estimated,
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

	// Military fleets on their last move: ≈ the jumps left at the fleet's own days per jump (since
	// the save before), else the empire's measured median, else DEFAULT_DAYS_PER_JUMP.
	for (const f of latest.fleets ?? []) {
		const stop = f.route.stops.at(-1);
		if (!f.route.moving || !stop || stop.jumps === null) continue;
		const before = previous?.fleets?.find(
			(p) => p.fleetId !== undefined && p.fleetId === f.fleetId
		);
		const own = daysPerJump(f.route, before?.route, elapsed * 30);
		const rate = own ?? perJump ?? DEFAULT_DAYS_PER_JUMP;
		const days = Math.round(stop.jumps * rate);
		out.push({
			date: fromDays(toDays(latest.date) + days),
			months: days / 30,
			kind: 'fleet',
			what: `${f.name} arrives at ${stop.system}`,
			tint: 'ship',
			detail: `${stop.jumps} jump${stop.jumps === 1 ? '' : 's'} · ≈ ${rate.toFixed(0)} days a jump (${own ? 'measured' : perJump ? 'our fleets’ median' : 'assumed'})`,
			exact: false,
			act: true, // nothing queued after: the fleet waits there
			fleetId: f.fleetId
		});
	}

	out.push(...leaderPoolRefresh(latest, data.defines.LEADER_POOL_REFRESH_TIME ?? 1800));
	out.push(...leaderLevelUps(latest, earlier, data.defines));

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

	// a nomad's energy and minerals never run out on their own: their pool changes level instead
	const pool = reserves(latest);
	out.push(...deficits(withReserves(latest, pool)).filter((d) => d.tint !== RESERVES));
	out.push(...reserveLevels(latest.date, pool, data.situationTypes[NOMAD_ECONOMY]?.stages ?? []));

	return out.sort((a, b) => toDays(a.date) - toDays(b.date) || a.what.localeCompare(b.what));
}

/**
 * The experience a leader needs from level `n` to the next: `LEADER_EXPERIENCE_REQUIREMENT_BASE_
 * VALUE` + `_SCALE_VALUE` × n(3n + 4) / 6 — 450, 1100, 2050 (100, 300). Measured, not in the
 * files (whose comment says 200 475 825 1250): the game's "Experience for next skill level: 1100" at
 * level 2 (Roaming Korinth 2204.12, 4.5.3, screenshot 2026-10-31_03-50-15), level 1 → 2 at exactly
 * 450 (Yorphian 2203.06: 313.1 + 151.5 → 14.6), no level 2 seen past 1093.5 nor level 3 past 2043
 * (Planetforgers 2213.10: → level 4 with 21). The experience starts again from the overflow.
 */
export function experienceToLevel(n: number, defines: Record<string, number> = {}): number {
	const base = defines.LEADER_EXPERIENCE_REQUIREMENT_BASE_VALUE ?? 100;
	const scale = defines.LEADER_EXPERIENCE_REQUIREMENT_SCALE_VALUE ?? 300;
	return base + (scale * n * (3 * n + 4)) / 6;
}

/**
 * When each leader reaches its next level, at the experience it gained a month since an earlier
 * save at the same level (traits like Eye for Talent included); none past the skill cap (level and
 * its own extra levels at `LEADER_BASE_SKILL_CAP`, 10), nor without a measured gain.
 */
export function leaderLevelUps(
	latest: Pick<Snapshot, 'date' | 'leaderList'>,
	earlier: Pick<Snapshot, 'date' | 'leaderList'>[],
	defines: Record<string, number> = {}
): Upcoming[] {
	const cap = defines.LEADER_BASE_SKILL_CAP ?? 10;
	return (latest.leaderList ?? []).flatMap((l) => {
		if (l.experience === null || l.experience === undefined) return [];
		if (l.level + (l.bonus ?? 0) >= cap) return [];
		const then = (s: Pick<Snapshot, 'leaderList'>) =>
			s.leaderList?.find((x) => x.id === l.id && x.level === l.level)?.experience;
		const base = earlier.findLast(
			(s) => typeof then(s) === 'number' && monthTicks(s.date, latest.date) >= 1
		);
		if (!base) return [];
		const rate = (l.experience - then(base)!) / monthTicks(base.date, latest.date);
		const need = experienceToLevel(l.level, defines);
		const when = due(latest.date, need - l.experience, rate);
		return when
			? [
					{
						...when,
						kind: 'leaders' as const,
						sub: 'level up',
						act: false,
						what: `${l.name} reaches level ${l.level + 1}`,
						tint: `class-${l.class}`,
						done: l.experience,
						total: need,
						detail: `${l.class} · ${Math.round(l.experience)} / ${need} experience · +${rate.toFixed(1)}/month`,
						exact: false
					}
				]
			: [];
	});
}

/**
 * When the game replaces the recruitable leaders: `LEADER_POOL_REFRESH_TIME` (1800 days) after
 * the pool was filled — the earliest `date_added` of its leaders (2200.01.01 → "Refreshes
 * 2205.01.01", 4.5.3). Estimated: an event may refresh it early (`refresh_leader_pool`).
 */
export function leaderPoolRefresh(
	latest: Pick<Snapshot, 'date' | 'leaderPool'>,
	refreshDays: number
): Upcoming[] {
	const added = (latest.leaderPool ?? []).flatMap((l) => (l.added ? [toDays(l.added)] : []));
	if (!added.length) return [];
	const due = Math.min(...added) + refreshDays;
	if (due < toDays(latest.date)) return [];
	const pool = latest.leaderPool!;
	const left = [...new Set(pool.map((l) => l.class))].map((c) => {
		const n = pool.filter((l) => l.class === c).length;
		return `${n} ${c}${n === 1 ? '' : 's'}`;
	});
	return [
		{
			date: fromDays(due),
			months: (due - toDays(latest.date)) / 30,
			kind: 'leaders',
			sub: 'leader pool',
			act: false,
			what: 'Recruitable leaders refresh',
			tint: 'leader',
			detail: `${left.join(', ')} to pick from until then`,
			exact: false
		}
	];
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

/**
 * When a nomad's Operational Reserves reach their next level at this month's net (#lib/nomad.ts):
 * each level is a stage of `situation_nomad_economy` with its own modifiers — Critical cripples
 * research and production. The game does not warn ahead.
 */
export function reserveLevels(now: string, r: Reserves | null, names: string[]): Upcoming[] {
	const next = r && nextStage(r);
	if (!r || !next) return [];
	const months = Math.ceil(next.months);
	const name = names[next.stage] ?? `stage ${next.stage + 1}`;
	return [
		{
			date: fromDays(toDays(now) + months * 30),
			months,
			kind: 'deficit',
			act: r.monthly < 0,
			what: `Operational Reserves ${r.monthly < 0 ? 'fall' : 'rise'} to ${name}`,
			tint: RESERVES,
			detail: `${fmt(r.stock)} of ${fmt(r.capacity ?? 0)} · ${r.monthly >= 0 ? '+' : ''}${r.monthly.toFixed(1)}/month`,
			exact: !r.estimated
		}
	];
}

const ACTION_KINDS: Record<ActionKind, string> = {
	decision: 'decision',
	artifact_action: 'artifact action',
	astral_action: 'astral action',
	relic: 'relic',
	diplomatic_action: 'diplomacy',
	federation_law: 'federation law',
	enclave: 'enclave'
};
// what one timer blocks when it blocks many actions of a kind (every relic waits on
// `relic_activation_cooldown`)
const ACTION_GROUPS: Record<ActionKind, string> = {
	decision: 'Decisions',
	artifact_action: 'Artifact actions',
	astral_action: 'Astral actions',
	relic: 'A relic triumph',
	diplomatic_action: 'Diplomatic actions',
	federation_law: 'A federation law change',
	enclave: 'Enclave deals'
};

/** A timed modifier or flag on the empire or one of its colonies. */
export type Timer = TimedModifier & {
	kind: 'modifier' | 'flag';
	colony?: Pick<Colony, 'name' | 'planetId'>;
};

/** Every timer a snapshot holds; `sdash_*` (the companion mod's daily tick) left out. */
export function timersOf(
	s: Pick<Snapshot, 'colonies' | 'countryModifiers' | 'countryTimedFlags'>
): Timer[] {
	return [
		...(s.countryModifiers ?? []).map((m) => ({ ...m, kind: 'modifier' as const })),
		...(s.countryTimedFlags ?? []).map((m) => ({ ...m, kind: 'flag' as const })),
		...s.colonies.flatMap((colony) => [
			...(colony.planet?.modifiers ?? []).map((m) => ({ ...m, kind: 'modifier' as const, colony })),
			...(colony.timedFlags ?? []).map((m) => ({ ...m, kind: 'flag' as const, colony }))
		])
	].filter((t) => !t.key.startsWith('sdash_'));
}

/** How a timer reads: the actions waiting on it (`label`, the rest in `more`), those it came from. */
function describeTimer(
	t: Timer,
	data: Pick<GameData, 'actionTimers'>,
	title: (ref: string) => string | undefined
) {
	const actions = data.actionTimers[`${t.kind}:${t.key}`] ?? [];
	const waiting = [...new Set(actions.filter((a) => a.cooldown).map((a) => a.name))];
	const bonus = [...new Set(actions.filter((a) => a.bonus).map((a) => a.name))];
	const from = [...new Set(actions.filter((a) => !a.cooldown && !a.bonus).map((a) => a.name))];
	const kinds = new Set(actions.filter((a) => a.cooldown).map((a) => a.kind));
	const name =
		t.kind === 'modifier'
			? (title(`modifier:${t.key}`) ?? pretty(t.key))
			: (waiting[0] ?? from[0] ?? pretty(t.key));
	const grouped = waiting.length > 3 && kinds.size === 1;
	// a bonus timer leaves the action possible: what comes back is the timer's own effect
	// (Satisfying Insult, with the next Insult)
	const label = grouped
		? ACTION_GROUPS[[...kinds][0]]
		: !waiting.length || t.kind !== 'modifier'
			? name
			: listed(waiting);
	return {
		// the actions that give a row: waiting on it, else regaining it as a bonus
		waiting: waiting.length ? waiting : bonus,
		from,
		name,
		label,
		// a modifier's own name tells what ran out; a flag's row names the first action
		more: !waiting.length
			? `with the next ${listed(bonus)}`
			: t.kind === 'modifier'
				? name
				: listed(waiting.slice(1)) || 'cooldown',
		sub: actions[0] ? ACTION_KINDS[actions[0].kind] : t.kind === 'flag' ? 'timer' : undefined,
		unnamed: actions.length === 0,
		where: t.colony?.name
	};
}

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

	for (const t of timersOf(latest)) {
		if (!t.until || t.until <= now) continue;
		const d = describeTimer(t, data, title);
		if (t.kind === 'flag' && d.unnamed && !hiddenTimers) continue;
		const waits = d.waiting.length > 0;
		out.push(
			row(t.until, {
				kind: waits ? 'cooldown' : 'expires',
				sub: d.sub,
				what: waits ? `${d.label} available again` : `${d.name} ends`,
				detail: [
					d.where,
					waits
						? d.more
						: d.from.length
							? `from ${listed(d.from)}`
							: t.kind === 'flag'
								? 'event timer (spoiler)'
								: ''
				]
					.filter(Boolean)
					.join(' · '),
				tint: waits ? 'cooldown' : 'expires',
				ref: t.kind === 'modifier' ? `modifier:${t.key}` : undefined,
				act: waits,
				planetId: t.colony?.planetId
			})
		);
	}

	for (const a of engineCooldowns(latest.cooldowns))
		if (a.until > now)
			out.push(
				row(a.until, {
					kind: 'cooldown',
					what: `${a.what} possible`,
					detail: a.detail,
					tint: 'cooldown',
					act: true
				})
			);

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

/**
 * The engine's own cooldowns, from the save's dates (`cooldowns` in `server/save.ts`): an id per
 * instance (one per species right, one per empire insulted), the action, where.
 */
function engineCooldowns(c: Snapshot['cooldowns']) {
	const out: { id: string; until: string; what: string; detail: string }[] = [];
	const add = (id: string, until: string | null | undefined, what: string, detail: string) => {
		if (until) out.push({ id, until, what, detail });
	};
	add('reform', c?.reform, 'Government reform', 'government');
	add('focus-dismiss', c?.focusDismiss, 'Dismiss a focus card', 'focus');
	add('focus-change', c?.focusChange, 'Change the focus priority', 'focus');
	add('capital', c?.capital, 'Moving the capital', 'capital');
	for (const r of c?.rights ?? [])
		add(
			`right:${r.species}:${r.right}`,
			r.until,
			`Changing ${r.species} ${r.right}`,
			'species rights'
		);
	for (const i of c?.insults ?? [])
		add(`insult:${i.country}`, i.until, `Insulting ${i.country}`, 'diplomacy');
	return out;
}

/**
 * Cooldowns that have run out and stay until used again or dismissed (the user's ask
 * 2026-10-25). Along the branch's saves (latest last), each cooldown instance — a timer an action
 * waits on, per scope (the empire or a colony, so one decision on two colonies is two rows), a
 * launched agenda, the reform and focus dates — keeps its latest end seen. Once that has passed,
 * it is available: renewing it in game sets a later end and the row goes; `dismissed` holds the
 * ids (`<scope>:<kind>:<key>:<until>`) the player dismissed, so the next round shows again.
 */
export function timedOut(
	saves: Pick<
		Snapshot,
		'date' | 'colonies' | 'countryModifiers' | 'countryTimedFlags' | 'agendaCooldowns' | 'cooldowns'
	>[],
	data: Pick<GameData, 'actionTimers' | 'agendas'>,
	title: (ref: string) => string | undefined = () => undefined,
	dismissed: ReadonlySet<string> = new Set()
): Upcoming[] {
	const latest = saves.at(-1);
	if (!latest) return [];
	type Seen = Pick<Upcoming, 'what' | 'sub' | 'detail' | 'ref' | 'planetId' | 'exact'> & {
		until: string;
	};
	const last = new Map<string, Seen>();
	const see = (id: string, seen: Seen) => {
		const cur = last.get(id);
		if (!cur || seen.until > cur.until) last.set(id, seen);
	};
	for (const s of saves) {
		for (const t of timersOf(s)) {
			if (!t.until) continue;
			const d = describeTimer(t, data, title);
			if (!d.waiting.length) continue;
			see(`${t.colony ? `planet:${t.colony.planetId}` : 'country'}:${t.kind}:${t.key}`, {
				until: t.until,
				what: `${d.label} available`,
				sub: d.sub,
				detail: [d.where, d.more].filter(Boolean).join(' · '),
				ref: t.kind === 'modifier' ? `modifier:${t.key}` : undefined,
				planetId: t.colony?.planetId,
				exact: true
			});
		}
		for (const a of s.agendaCooldowns ?? [])
			see(`country:agenda:${a.key}`, {
				until: a.until,
				what: `${data.agendas[a.key]?.name ?? a.key} can be picked again`,
				sub: 'agenda',
				detail: 'council agenda',
				ref: `agenda:${a.key}`,
				exact: true
			});
		for (const a of engineCooldowns(s.cooldowns))
			see(`country:${a.id}`, {
				until: a.until,
				what: `${a.what} possible`,
				sub: 'available',
				detail: a.detail,
				exact: true
			});
	}
	const colonies = new Set(latest.colonies.map((c) => c.planetId));
	return [...last]
		.filter(
			([id, v]) =>
				v.until <= latest.date &&
				!dismissed.has(`${id}:${v.until}`) &&
				(v.planetId === undefined || colonies.has(v.planetId))
		)
		.map(([id, v]) => ({
			date: v.until,
			months: 0,
			kind: 'cooldown' as const,
			sub: v.sub ?? 'available',
			what: v.what,
			detail: `${v.detail ? `${v.detail} · ` : ''}since ${v.until}`,
			tint: 'cooldown',
			ref: v.ref,
			planetId: v.planetId,
			exact: v.exact,
			act: true,
			dismiss: `${id}:${v.until}`
		}));
}

/**
 * The next roll of each envoy on a first contact and each excavation: the save's `days_left`
 * counts down to it (first contacts and dig sites both carry `last_roll`). The game reports what
 * a roll gives, so `act` is false.
 */
export function rolls(latest: Pick<Snapshot, 'date' | 'firstContacts' | 'digSites'>): Upcoming[] {
	const at = (days: number) => fromDays(toDays(latest.date) + days);
	const contacts = (latest.firstContacts ?? [])
		.filter((c) => c.status === 'in_progress' && c.leaderId !== null && c.daysLeft !== null)
		.map((c) => ({
			date: at(c.daysLeft!),
			months: c.daysLeft! / 30,
			kind: 'roll' as const,
			sub: 'first contact',
			what: `Next roll: ${c.name}`,
			detail: `${c.leaderName ?? 'envoy'} · ${c.clues} clues · difficulty ${c.difficulty}`,
			tint: 'roll',
			exact: true,
			act: false
		}));
	const sites = (latest.digSites ?? [])
		.filter((s) => s.excavating && s.daysLeft !== null)
		.map((s) => ({
			date: at(s.daysLeft!),
			months: s.daysLeft! / 30,
			kind: 'roll' as const,
			sub: 'excavation',
			what: `Next excavation roll: ${pretty(s.type.replace(/^site_/, ''))}`,
			detail: `${s.clues} clues · difficulty ${s.difficulty}`,
			tint: 'roll',
			exact: true,
			act: false
		}));
	return [...contacts, ...sites];
}
