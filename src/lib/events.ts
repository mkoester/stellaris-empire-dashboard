import { monthsLeft, orderLabel, orderRate } from './ships.ts';
import type { QueueItem, Snapshot } from './types.ts';

// Upcoming events of the empire: when current research, the next tradition, the council agenda,
// queued construction and the next election are due. Pure; the page shows them as one list.
//
// Rates are measured, not computed: progress between the two latest saves of the branch, so every
// speed bonus is included. Costs are base costs from the game data scaled by what the save knows
// (empire size, galaxy cost sliders) — other cost modifiers are unknown, hence "estimated".

import type { GameData } from './types.ts';
export type { GameData };

export type Upcoming = {
	date: string; // when it is due, "2200.09.01"
	months: number; // from the snapshot's date
	kind: 'research' | 'tradition' | 'agenda' | 'construction' | 'shipyard' | 'ship' | 'election';
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
};

/**
 * Tech costs in game were ×1.05 of the base cost at empire size 50 (4.5.2, cadet, technology
 * slider 1, "scaling_normal"): 1575 for a 1500 tech, 1050 for 1000. Source unconfirmed —
 * possibly TECH_COST_DIFFICULTY_SCALE_MULT (0.025) × 2.
 */
const TECH_COST_OBSERVED_FACTOR = 1.05;

// ── Game calendar: 12 months of 30 days ────────────────────────────────────

export function toDays(date: string): number {
	const [y, m, d] = date.split('.').map(Number);
	return (y * 12 + m - 1) * 30 + d - 1;
}

export function fromDays(days: number): string {
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
	return base * sizePenalty(size, d.EMPIRE_SIZE_TRADITION_COST_PENALTY, d) * setting;
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

/**
 * `latest` is the state shown; `previous` the save before it on the same branch (for rates).
 * Sorted by due date.
 */
export function upcoming(latest: Snapshot, previous: Snapshot | null, data: GameData): Upcoming[] {
	const p = latest.progress;
	if (!p) return [];
	const out: Upcoming[] = [];
	const elapsed = previous?.progress ? monthsBetween(previous.date, latest.date) : 0;
	const d = data.defines;

	for (const r of p.research) {
		const tech = data.techs[r.tech];
		if (!tech?.cost) continue;
		const cost =
			tech.cost *
			p.costSettings.technology *
			sizePenalty(latest.empireSize, d.EMPIRE_SIZE_TECH_COST_PENALTY, d) *
			TECH_COST_OBSERVED_FACTOR;
		const before = previous?.progress?.research.find((x) => x.tech === r.tech);
		const rate =
			before && elapsed > 0
				? (r.progress - before.progress) / elapsed
				: (latest.income?.[`${r.area}_research`] ?? 0);
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
		const before = previous?.progress?.agenda;
		const rate =
			before?.key === p.agenda.key && elapsed > 0
				? (p.agenda.progress - before.progress) / elapsed
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

	// Build queues: progress counts days. A planet builds `buildSlots` items at once; the rest wait.
	for (const c of latest.colonies)
		out.push(
			...queueEvents(latest.date, c.buildQueue, c.buildSlots, 'construction', (item) => ({
				what: item.name,
				detail: `${c.name} · ${item.kind.replaceAll('_', ' ')}`,
				planetId: c.planetId
			}))
		);

	// Civilian ships, by the same rules: ⚠ when nothing is queued after the current order; an idle
	// ship is due now.
	for (const s of latest.civilianShips ?? []) {
		const left = monthsLeft(s, orderRate(s, previous, elapsed), (d) =>
			monthsBetween(latest.date, d)
		);
		if (left === null) continue;
		const days = Math.round(left * 30);
		out.push({
			date: fromDays(toDays(latest.date) + days),
			months: days / 30,
			kind: 'ship',
			what: s.order ? orderLabel(s.order) : `${s.kind.replaceAll('_', ' ')} idle`,
			tint: 'ship',
			detail: `${s.name} · ${s.kind.replaceAll('_', ' ')}`,
			exact: s.order === null,
			act: s.queue.length === 0,
			queuedAfter: s.queue.length,
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

	return out.sort((a, b) => toDays(a.date) - toDays(b.date) || a.what.localeCompare(b.what));
}
