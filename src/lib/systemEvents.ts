// The popups entering a system fires — Bir's "Crystalline Asteroids" (the Asteroid Hive
// guardian), Helitio's "Missing Orbitals", ruined megastructures, the Star Mall … From the data
// DB's `system_entry_event` (the events of `on_entering_system_first_time`, `on_entering_system`
// and `on_entering_system_fleet` that test star flags on the system entered), matched against a
// system's star flags. The events' other conditions (who
// enters, global flags) are not checked: a match is the popup that system likely showed. Pure.

export type EntryEvent = {
	id: string; // e.g. "leviathans.3202"
	title: string;
	description: string | null; // a scope's name shown as "…"
	flags: string[]; // the system has all of them
	anyFlags: string[]; // and one of these, where any (an OR in the trigger)
	notFlags: string[]; // and none of these
	onceFlag: string | null; // fires once per empire: the country flag it wants unset and sets
};

/** A system we have entered whose flags match one or more entry events. */
export type SystemEntry = {
	systemId: number;
	system: string;
	events: EntryPopup[];
};

/**
 * One popup at a system: `once` its once-per-empire flag (apoc.1: only the first gateway found);
 * `among` the number of systems first entered between two saves that may each have been it.
 */
export type EntryPopup = { id: string; title: string; once?: string; among?: number };

/** The entry events a system with these star flags fires, in the on_action's order. */
export function entryEventsFor(flags: string[], events: EntryEvent[]): EntryEvent[] {
	const has = new Set(flags);
	return events.filter(
		(e) =>
			e.flags.every((f) => has.has(f)) &&
			(e.anyFlags.length === 0 || e.anyFlags.some((f) => has.has(f))) &&
			!e.notFlags.some((f) => has.has(f))
	);
}

/** The label of a system's entry: "Bir: Crystalline Asteroids". */
export const entryLabel = (e: Pick<SystemEntry, 'system' | 'events'>) =>
	`${e.system}: ${entryTitles(e)}`;

/** Its popups' titles, once each — a chain's often share one ("Missing Orbitals"). */
export const entryTitles = (e: Pick<SystemEntry, 'events'>) =>
	[...new Set(e.events.map((x) => x.title + (x.among ? ` (one of ${x.among} systems)` : '')))].join(
		', '
	);

/** What a save tells: the entries it lists, and our country flags. */
export type EntryReading = { entries?: SystemEntry[] | null; flags?: string[] | null };

/**
 * Each system at the reading that first lists it (`at`), with the popups it showed. A
 * once-per-empire popup sets its flag at once, so it showed at a newly listed system only if the
 * flag was unset at the last reading that listed entries and is set now: of the nomad game's
 * abandoned gateways, Urakhannon's Maw (listed 2204.01, flag still unset — its extra condition
 * failed) showed none, Acamar (listed 2205.07.21, flag set since 2205.05) the one. Readings
 * without entries (saves of an older reader) say nothing about which systems, so their flags do
 * not count. Several systems first listed in one interval sharing it: each `among` N. A system's
 * later readings do not count: the popup's own outcome can set a flag that no longer matches
 * (Helito's `solarpunk_system_revealed`).
 */
export function firstEntries(readings: EntryReading[]): (SystemEntry & { at: number })[] {
	const seen = new Set<number>();
	let before: Set<string> | null = null; // flags at the last reading with entries
	const out: (SystemEntry & { at: number })[] = [];
	readings.forEach((r, at) => {
		if (!r.entries) return;
		const now = r.flags ? new Set(r.flags) : null;
		const fresh = r.entries.filter((e) => !seen.has(e.systemId));
		for (const e of fresh) seen.add(e.systemId);
		const fired = (x: EntryPopup) =>
			!x.once || (!before?.has(x.once) && (now === null || now.has(x.once)));
		const sharing = new Map<string, number>();
		for (const e of fresh)
			for (const x of e.events.filter(fired))
				if (x.once) sharing.set(x.once, (sharing.get(x.once) ?? 0) + 1);
		for (const e of fresh) {
			const events = e.events.filter(fired).map((x) => {
				const n = x.once ? (sharing.get(x.once) ?? 0) : 0;
				return n > 1 ? { ...x, among: n } : x;
			});
			if (events.length) out.push({ ...e, events, at });
		}
		if (now) before = now;
	});
	return out;
}

/** A popup's text as a marker's detail: its first sentence, short. */
export function entryDetail(description: string | null | undefined): string {
	const first = (description ?? '')
		.split(/(?<=[.!?])\s/)[0]
		.replace(/\s+/g, ' ')
		.trim();
	const text = first.length > 140 ? `${first.slice(0, 139)}…` : first;
	return text ? `on first entry: ${text}` : 'on first entry';
}
