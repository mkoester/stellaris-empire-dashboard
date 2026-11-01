// The known history of the galaxy since 2200 (the history tab): who held which system when,
// colonies founded, communications opened, guardians slain, wars — filtered by what we know.
// **What we know** is decided at the branch's latest save and applied to the whole past (the
// user's rule, 2026-11-01: "the more empires we establish communication with, the more history
// can be shown even in retrospective"):
// - our own history, always;
// - an empire's systems and colonies once we have communications with it — all of them, back to
//   the start;
// - a system's owner where we have been ourselves (visited, at any time), whoever it was;
// - a guardian's fall: common knowledge;
// - a war where one side is an empire we know (wars are public, as on the diplomacy tab).
// Not known: what others found (surveys, anomalies) and battles we did not fight.
// `all` (a cheat) shows everything.
// Before the first save read only colonies with their `colonize_date` are known; a system whose
// colony predates that save counts as its owner's since the colony's date.
import type { HistoryReading, WarSides } from './types.ts';

export type HistoryInput = {
	date: string;
	history: HistoryReading;
	communications: number[]; // countries we had communications with at this save
	visited: number[]; // systems we had visited (or held)
	wars: WarSides[];
	names?: [number, string][]; // more names: ours, those we talk to (relations)
};

export type OwnerChange = {
	systemId: number;
	date: string;
	from: number | null;
	to: number | null;
	exact: boolean; // false: happened by this date (between two saves, or before the first)
	initial: boolean; // held at the first save read: no event
};

export type HistoryEvent = {
	date: string;
	exact: boolean;
	kind: 'colony' | 'gained' | 'lost' | 'communications' | 'guardian' | 'war';
	countryId: number | null;
	systemId: number | null;
	text: string;
};

export type History = {
	changes: OwnerChange[]; // in date order
	events: HistoryEvent[]; // in date order
	names: Record<number, string>;
	known: number[]; // the countries whose history we know (empty with `all`: everyone)
	start: string; // the first save read
};

const GUARDIAN_TEXT: Record<string, string> = {
	killed_guardian: 'slew a guardian',
	horror_killed: 'slew the Horror',
	killed_wraith: 'slew the Spectral Wraith',
	tiyanki_killed: 'slew the Tiyanki matriarch',
	killed_hatchling: 'slew the Ether Drake hatchling',
	toxic_god_killed: 'The Toxic God fell',
	guardians_zanaam_destroyed: 'Zanaam fell'
};

/** The branch's history as far as we know it at its latest save, or all of it with `all`. */
export function knownHistory(inputs: HistoryInput[], us: number, all = false): History {
	const readings = inputs.filter((x) => x.history);
	const names: Record<number, string> = {};
	for (const r of readings)
		for (const [id, n] of [...(r.names ?? []), ...r.history.names]) names[id] = n;
	const last = readings.at(-1);
	if (!last) return { changes: [], events: [], names, known: [], start: '' };
	const known = new Set([us, ...last.communications]);
	const visited = new Set(last.visited);
	const knows = (country: number | null) => all || (country !== null && known.has(country));
	const showChange = (c: OwnerChange) =>
		all || knows(c.from) || knows(c.to) || visited.has(c.systemId);

	// owners: the first save's as of the colonies' dates where they predate it, then each change
	const first = readings[0];
	const colonyDate = new Map<string, string>(); // `${system}:${owner}` → earliest colony date
	for (const [, owner, date, system] of first.history.colonies)
		if (date) {
			const k = `${system}:${owner}`;
			const d = colonyDate.get(k);
			if (!d || date < d) colonyDate.set(k, date);
		}
	const changes: OwnerChange[] = [];
	let prev = new Map<number, number>();
	readings.forEach((r, i) => {
		const now = new Map(r.history.owners);
		for (const [sys, owner] of now)
			if (prev.get(sys) !== owner) {
				const since = i === 0 ? colonyDate.get(`${sys}:${owner}`) : undefined;
				changes.push({
					systemId: sys,
					date: since ?? r.date,
					from: prev.get(sys) ?? null,
					to: owner,
					exact: false,
					initial: i === 0
				});
			}
		if (i > 0)
			for (const [sys, owner] of prev)
				if (!now.has(sys))
					changes.push({
						systemId: sys,
						date: r.date,
						from: owner,
						to: null,
						exact: false,
						initial: false
					});
		prev = now;
	});

	const events: HistoryEvent[] = [];
	const name = (id: number | null) => (id === null ? '?' : (names[id] ?? `empire ${id}`));
	for (const c of changes) {
		if (c.initial || !showChange(c)) continue;
		const base = { date: c.date, exact: c.exact, systemId: c.systemId };
		if (c.to === null)
			events.push({
				...base,
				kind: 'lost',
				countryId: c.from,
				text: `${name(c.from)} lost a system`
			});
		else if (c.from === null)
			events.push({
				...base,
				kind: 'gained',
				countryId: c.to,
				text: `${name(c.to)} claimed a system`
			});
		else
			events.push({
				...base,
				kind: 'gained',
				countryId: c.to,
				text: `${name(c.to)} took a system from ${name(c.from)}`
			});
	}
	// colonies: each planet once, at its colonize_date, else the first save listing it
	const seen = new Set<number>();
	for (const r of readings)
		for (const [planet, owner, date, system] of r.history.colonies) {
			if (seen.has(planet)) continue;
			seen.add(planet);
			if (!knows(owner) && !visited.has(system)) continue;
			events.push({
				date: date ?? r.date,
				exact: date !== null,
				kind: 'colony',
				countryId: owner,
				systemId: system,
				text: `${name(owner)} founded a colony`
			});
		}
	// communications: the first save with them, ours always known
	const met = new Set<number>();
	for (const r of readings)
		for (const id of r.communications)
			if (!met.has(id)) {
				met.add(id);
				if (r !== first)
					events.push({
						date: r.date,
						exact: false,
						kind: 'communications',
						countryId: id,
						systemId: null,
						text: `we opened communications with ${name(id)}`
					});
			}
	// guardians: common knowledge, at the flag's date
	for (const g of last.history.guardians)
		events.push({
			date: g.date ?? last.date,
			exact: g.date !== null,
			kind: 'guardian',
			countryId: g.countryId,
			systemId: null,
			text:
				g.countryId === null
					? GUARDIAN_TEXT[g.flag]
					: `${name(g.countryId)} ${GUARDIAN_TEXT[g.flag]}`
		});
	// wars, by their start
	const wars = new Map<string, WarSides>();
	for (const r of readings) for (const w of r.wars) if (!wars.has(w.id)) wars.set(w.id, w);
	for (const w of wars.values())
		if ([...w.attackers, ...w.defenders].some(knows))
			events.push({
				date: w.start ?? first.date,
				exact: w.start !== null,
				kind: 'war',
				countryId: w.attackers[0] ?? null,
				systemId: null,
				text: `${w.name}: ${w.attackers.map(name).join(', ')} against ${w.defenders.map(name).join(', ')}`
			});

	events.sort((a, b) => a.date.localeCompare(b.date));
	return {
		changes: changes.filter(showChange).sort((a, b) => a.date.localeCompare(b.date)),
		events,
		names,
		known: all ? [] : [...known],
		start: first.date
	};
}

/** Each system's owner at `date`, replaying the changes up to it. */
export function ownersAt(changes: OwnerChange[], date: string): Map<number, number> {
	const out = new Map<number, number>();
	for (const c of changes) {
		if (c.date > date) break;
		if (c.to === null) out.delete(c.systemId);
		else out.set(c.systemId, c.to);
	}
	return out;
}

/** The months from 2200.01 to `last`, as "YYYY.MM.01". */
export function months(last: string): string[] {
	const [y, m] = last.split('.').map(Number);
	const out: string[] = [];
	for (let yy = 2200, mm = 1; yy < y || (yy === y && mm <= m); mm === 12 ? (yy++, (mm = 1)) : mm++)
		out.push(`${yy}.${String(mm).padStart(2, '0')}.01`);
	return out;
}
