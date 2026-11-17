// The known history of the galaxy since 2200 (the history tab): who held which system when,
// colonies founded, communications opened, guardians slain, wars — filtered by what we know.
// **What we know** is decided at the branch's latest save and applied to the whole past (the
// user's rules, 2026-11-01: "the more empires we establish communication with, the more history
// can be shown even in retrospective"; 2026-11-17: only empires we met, as far as our intel on
// each goes — `common/intel_categories`, levels by `levelOf()`):
// - our own history, always;
// - an empire we met (a relation): its systems with military intel 1 ("Location of Starbases";
//   economy 4, "High Intel on Systems", comes later) and its colonies with economy intel 1 ("Low
//   Intel on Colonies") — military and economy levels are the same at every intel value
//   (00_intel_levels.txt), so both from intel 30; its wars with diplomacy intel 1 (intel 20);
// - an empire not met: nothing; where it takes a system from one we know it is "an unknown
//   empire";
// - a guardian's fall: common knowledge, its slayer named as above.
// Not known: what others found (surveys, anomalies) and battles we did not fight.
// Modes: `known` (the default), `met` (a spoiler: everything about the empires we met), `all` (a
// cheat: everything about every empire, by its own name).
// Before the first save read only colonies with their `colonize_date` are known; a system whose
// colony predates that save counts as its owner's since the colony's date.
import { levelOf } from './diplomacy.ts';
import type { HistoryReading, WarSides } from './types.ts';

export type HistoryMode = 'known' | 'met' | 'all';

export type HistoryInput = {
	date: string;
	history: HistoryReading;
	communications: number[]; // countries we had communications with at this save
	wars: WarSides[];
	names?: [number, string][]; // more names: ours, those we talk to (relations)
	met?: number[]; // countries we have a relation with: met
	intel?: [number, number][]; // our intel on each (0–100)
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

/** The branch's history as far as we know it at its latest save (`mode`, see above). */
export function knownHistory(
	inputs: HistoryInput[],
	us: number,
	mode: HistoryMode = 'known'
): History {
	const all = mode === 'all';
	const readings = inputs.filter((x) => x.history);
	// the names we know them by (pre-communications until we talk); the save's own names of every
	// country only with `all` — they would spoil a first contact (the user's ask 2026-11-17)
	const names: Record<number, string> = {};
	for (const r of readings)
		for (const [id, n] of all ? [...(r.names ?? []), ...r.history.names] : (r.names ?? []))
			names[id] = n;
	const last = readings.at(-1);
	if (!last) return { changes: [], events: [], names, known: [], start: '' };
	const met = new Set([...(last.met ?? []), ...last.communications]);
	const intel = new Map(last.intel ?? []);
	// what we know of a country: everything of ourselves (and with `all`), of one we met by the
	// intel category's level (everything with `met`), nothing of a stranger
	const level = (country: number | null, at: (intel: number) => boolean) =>
		all ||
		country === us ||
		(country !== null && met.has(country) && (mode === 'met' || at(intel.get(country) ?? 0)));
	const systemsOf = (c: number | null) => level(c, (i) => levelOf(i, 'economy') >= 1);
	const coloniesOf = systemsOf; // economy 1 too
	const knows = (c: number | null) => level(c, (i) => levelOf(i, 'diplomacy') >= 1);
	const known = new Set([us, ...[...met].filter((c) => systemsOf(c) || knows(c))]);
	const showChange = (c: OwnerChange) => systemsOf(c.from) || systemsOf(c.to);

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
	const name = (id: number | null) =>
		id === null ? '?' : (names[id] ?? (all ? `empire ${id}` : 'an unknown empire'));
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
			if (!coloniesOf(owner)) continue;
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
	const talked = new Set<number>();
	for (const r of readings)
		for (const id of r.communications)
			if (!talked.has(id)) {
				talked.add(id);
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
				// the save's war name is made of the sides' own names: only where we know them all
				text: `${[...w.attackers, ...w.defenders].every(knows) ? `${w.name}: ` : ''}${w.attackers.map(name).join(', ')} against ${w.defenders.map(name).join(', ')}`
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
