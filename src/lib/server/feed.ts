import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import type { ColonyDay, LogEvent, Resources, Snapshot, Tick } from '#lib/types.ts';

// Reads the companion mod's lines from game.log (mod/dashboard_feed, events/sdash_events.txt):
//   SDASH|2|<date>|timeline|<id>|<previous id>              monthly, first
//   SDASH|2|<date>|<resource>|<stockpile>|<monthly income>   monthly, one per resource
//   SDASH|2|<date>|end                                        month complete
//   SDASH|2|<date>|tick|<resource>|<stockpile>  …  tick-end   daily stockpiles
//   SDASH|2|<date>|load|<id>                                  a save was loaded (0: unknown id)
//   SDASH|2|<date>|event|<kind>|<field>…                      at once (colony, war-started, …)
//   SDASH|2|<date>|event|colony-jobs|<colony>|<open jobs>|<unemployed>|<pops>
//                                    within the daily tick, a colony whose numbers changed (0.9.0)
// Format 1 (mod 0.1.0) had the monthly resource and end lines only. Format 3 (mod 0.7.0) is format
// 2 with a run id after the date on every line but events' — SDASH|3|<date>|<run>|end — drawn at
// each load: the game drops a line it has already written this session, so without it a branch
// replaying dates lost its month ends and ticks, and a second load of one save its load line.
// game.log prefixes each line with "[time][file:line]: "; everything before "SDASH|" is ignored.
// A format outside FEED_FORMATS (an outdated mod, or one newer than this build) is skipped and
// reported, never an error: the dashboard works without the mod, and no mod may break it.

export type Month = {
	date: string;
	stockpile: Resources;
	balance: Resources;
	timelineId: number | null;
	previousTimelineId: number | null;
	events: LogEvent[]; // since the month before, in log order
	ticks: Tick[];
};

/** The log formats this build reads. */
export const FEED_FORMATS = { min: 1, max: 3 };

/** A format this build does not read, from the oldest seen: `newer` = the mod is ahead. */
export type FeedFormat = { format: number; newer: boolean };

export type Line =
	| { kind: 'resource'; date: string; resource: string; stockpile: number; income: number }
	| { kind: 'end'; date: string }
	| { kind: 'timeline'; date: string; id: number; previous: number }
	| { kind: 'tick'; date: string; resource: string; stockpile: number }
	| { kind: 'tick-end'; date: string }
	| ({ kind: 'colony-day'; date: string; colony: string } & ColonyDay)
	| { kind: 'load'; date: string; id: number | null }
	| { kind: 'event'; event: LogEvent }
	| ({ kind: 'unsupported' } & FeedFormat);

/** What the log tells, line by line: a complete month, a day's stockpiles, a save loaded. */
export type Output =
	| { kind: 'month'; month: Month }
	| { kind: 'tick'; tick: Tick }
	| { kind: 'load'; date: string; id: number | null }
	| ({ kind: 'unsupported' } & FeedFormat);

const EVENT_FIELDS: Record<LogEvent['kind'], number> = {
	colony: 1, // planet
	'war-started': 1, // war
	'war-ended': 2, // loser, main winner
	'leader-died': 1, // leader
	ruler: 1, // the new ruler
	combat: 5, // winner, winner's fleet, loser, loser's fleet, system
	// mod 0.3.0: spending outside the budget
	'district-queued': 1, // colony
	'district-unqueued': 1,
	'building-queued': 1,
	'building-unqueued': 1,
	edict: 0, // the edict is not in the on_action's scope
	decision: 1, // colony
	'leader-hired': 1, // leader
	'colonization-started': 1, // planet
	'megastructure-started': 1, // system
	'system-entered': 1 // mod 0.10.0: the system a ship of ours entered first
};

/**
 * Parses one log line; null for unrelated lines, `unsupported` for a format this build does not
 * read, throws on a malformed SDASH line.
 */
export function parseLine(raw: string): Line | null {
	const at = raw.indexOf('SDASH|');
	if (at < 0) return null;
	const [, format, rawDate, ...fields] = raw.slice(at).trim().split('|');
	if (!/^\d+$/.test(format)) throw new Error(`malformed SDASH line: ${raw}`);
	const n = Number(format);
	if (n < FEED_FORMATS.min || n > FEED_FORMATS.max)
		return { kind: 'unsupported', format: n, newer: n > FEED_FORMATS.max };
	// format 3: format 2 behind the run id, which only makes the line unique
	const version = format === '3' ? '2' : format;
	const rest = format === '3' ? fields.slice(1) : fields;
	const date = gameDate(rawDate);
	const bad = () => new Error(`malformed SDASH line: ${raw}`);
	const num = (v: string | undefined) => {
		const n = Number(v);
		if (v === undefined || v === '' || !Number.isFinite(n)) throw bad();
		return n;
	};
	const [head, ...args] = rest;
	if (rest.length === 1 && head === 'end') return { kind: 'end', date };
	if (version === '2') {
		if (head === 'tick-end' && !args.length) return { kind: 'tick-end', date };
		if (head === 'tick' && args.length === 2 && args[0])
			return { kind: 'tick', date, resource: args[0], stockpile: num(args[1]) };
		if (head === 'timeline' && args.length === 2)
			return { kind: 'timeline', date, id: num(args[0]), previous: num(args[1]) };
		if (head === 'load' && args.length === 1) {
			const id = num(args[0]);
			return { kind: 'load', date, id: id === 0 ? null : id };
		}
		// mod 0.9.0: a colony's day, filed with the daily tick (an older dashboard skips the kind)
		if (head === 'event' && args[0] === 'colony-jobs') {
			if (args.length !== 5 || !args[1]) throw bad();
			return {
				kind: 'colony-day',
				date,
				colony: args[1],
				openJobs: num(args[2]),
				unemployed: num(args[3]),
				pops: num(args[4])
			};
		}
		if (head === 'event') {
			const [kind, ...fields] = args;
			// a newer mod's kind: skipped, so an older dashboard keeps reading the rest
			if (!(kind in EVENT_FIELDS)) return null;
			if (fields.length !== EVENT_FIELDS[kind as LogEvent['kind']]) throw bad();
			return { kind: 'event', event: { date, kind: kind as LogEvent['kind'], fields } };
		}
	}
	if (rest.length !== 3 || !head) throw bad();
	return { kind: 'resource', date, resource: head, stockpile: num(args[0]), income: num(args[1]) };
}

/** "2200.1.1" or "2200.01.01" → "2200.01.01", the form saves use. */
function gameDate(raw: string): string {
	const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(raw ?? '');
	if (!m) throw new Error(`unexpected date format in SDASH line: ${raw}`);
	return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

/**
 * Collects lines into months and days. Events and ticks go with the next month that completes, as
 * a save's changes go with the first save showing them; a load drops them — that future was left.
 */
export function assembler() {
	const months = new Map<string, Month>();
	const days = new Map<string, Resources>();
	const colonyDays = new Map<string, Record<string, ColonyDay>>();
	let events: LogEvent[] = [];
	let ticks: Tick[] = [];
	const monthOf = (date: string) => {
		const m = months.get(date) ?? {
			date,
			stockpile: {},
			balance: {},
			timelineId: null,
			previousTimelineId: null,
			events: [],
			ticks: []
		};
		months.set(date, m);
		return m;
	};
	return (line: Line): Output | null => {
		switch (line.kind) {
			case 'resource': {
				const m = monthOf(line.date);
				m.stockpile[line.resource] = line.stockpile;
				m.balance[line.resource] = line.income;
				return null;
			}
			case 'timeline': {
				const m = monthOf(line.date);
				m.timelineId = line.id;
				m.previousTimelineId = line.previous;
				return null;
			}
			case 'end': {
				const month = monthOf(line.date);
				months.delete(line.date);
				month.events = events.filter((e) => e.date <= month.date);
				month.ticks = ticks.filter((t) => t.date <= month.date);
				events = events.filter((e) => e.date > month.date);
				ticks = ticks.filter((t) => t.date > month.date);
				return { kind: 'month', month };
			}
			case 'tick':
				days.set(line.date, { ...days.get(line.date), [line.resource]: line.stockpile });
				return null;
			case 'colony-day': {
				const day = { openJobs: line.openJobs, unemployed: line.unemployed, pops: line.pops };
				colonyDays.set(line.date, { ...colonyDays.get(line.date), [line.colony]: day });
				return null;
			}
			case 'tick-end': {
				const colonies = colonyDays.get(line.date);
				const tick: Tick = {
					date: line.date,
					stockpile: days.get(line.date) ?? {},
					...(colonies && { colonies })
				};
				days.delete(line.date);
				colonyDays.delete(line.date);
				ticks.push(tick);
				return { kind: 'tick', tick };
			}
			case 'event':
				events.push(line.event);
				return null;
			case 'load':
				months.clear();
				days.clear();
				colonyDays.clear();
				events = [];
				ticks = [];
				return { kind: 'load', date: line.date, id: line.id };
			case 'unsupported':
				return line;
		}
	};
}

/** A month from the log as a (partial) snapshot of the campaign being played. */
export function toLogSnapshot(m: Month, campaign: string): Snapshot {
	return {
		kind: 'log',
		campaign,
		date: m.date,
		fingerprint: monthFingerprint(m),
		timelineId: m.timelineId,
		previousTimelineId: m.previousTimelineId,
		logEvents: m.events,
		ticks: m.ticks,
		countryId: null,
		empireName: '',
		pops: null,
		stockpile: m.stockpile,
		income: null,
		expenses: null,
		balance: m.balance,
		colonies: [],
		endGameYear: null,
		empireSize: null,
		starbases: null,
		navalUsed: null,
		navalMax: null,
		envoys: null,
		marketOrders: [],
		market: null,
		leaders: null,
		ships: null,
		defaultAutomation: null,
		automationBlocked: null,
		planetBudget: null,
		budget: null,
		construction: null,
		orbitalStations: null,
		aiIntel: null,
		storageMax: null,
		traderEnclaves: null,
		techQueued: null,
		techPermanent: null,
		techStored: null,
		score: null,
		fleets: null,
		idleLeaders: null,
		traditions: null,
		ascensionPerks: null,
		canDetox: null,
		habitatSites: null,
		habitats: null,
		civilianShips: null,
		edicts: null,
		countryModifiers: null,
		countryTimedFlags: null,
		cooldowns: null,
		species: null,
		sectors: null,
		expansion: null,
		stations: null,
		migration: null,
		knownSystems: null,
		megaShipyards: null,
		progress: null,
		leaderRoster: null,
		ruler: null,
		agendasDone: null,
		policies: null,
		government: null,
		governmentType: null,
		origin: null,
		wars: null,
		subjects: null,
		galcom: null,
		claims: null,
		factions: null,
		ethics: null,
		combats: null,
		shroud: null,
		warLostDate: null,
		tradeDeals: null,
		gameVersion: null,
		dlcs: null,
		mods: null,
		countryType: null,
		policyFlags: null,
		countryFlags: null,
		council: null,
		councilSlots: null,
		edictTimes: null,
		galaxy: null,
		countries: null,
		relations: null,
		intel: null,
		diplomacy: null,
		allWars: null,
		firstContacts: null,
		situations: null,
		anomalies: null,
		specialProjects: null,
		digSites: null,
		stationsSeen: null,
		surveyedAll: null,
		focus: null,
		techOptions: null,
		leaderList: null,
		leaderPool: null,
		wanderlust: null,
		entryEvents: null,
		founderClass: null,
		speciesRights: null
	};
}

export function monthFingerprint(m: Month): string {
	const body = JSON.stringify([m.date, Object.entries(m.stockpile).sort()]);
	return `log:${createHash('sha1').update(body).digest('hex').slice(0, 16)}`;
}

export type TailOptions = {
	onMonth: (m: Month) => void;
	onTick?: (t: Tick) => void;
	onLoad?: (date: string, id: number | null) => void;
	/** a line in a format this build does not read (skipped) */
	onUnsupported?: (f: FeedFormat) => void;
	onError: (e: unknown) => void;
	intervalMs?: number;
};

/**
 * Follows game.log from its current end: older lines carry no campaign, so they cannot be placed.
 * The game recreates the file on each launch; a shrinking file restarts reading from the top.
 */
export async function tailLog(file: string, opts: TailOptions): Promise<() => void> {
	const { intervalMs = 1000 } = opts;
	let offset = await size(file);
	let partial = '';
	const add = assembler();

	let busy = false;
	const timer = setInterval(async () => {
		if (busy) return;
		busy = true;
		try {
			const now = await size(file);
			if (now < offset) {
				offset = 0;
				partial = '';
			}
			if (now === offset) return;
			const fh = await open(file, 'r');
			try {
				const buf = Buffer.alloc(now - offset);
				await fh.read(buf, 0, buf.length, offset);
				offset = now;
				const lines = (partial + buf.toString('utf8')).split('\n');
				partial = lines.pop() ?? '';
				for (const raw of lines) {
					try {
						const line = parseLine(raw);
						const out = line && add(line);
						if (out?.kind === 'month') opts.onMonth(out.month);
						else if (out?.kind === 'tick') opts.onTick?.(out.tick);
						else if (out?.kind === 'load') opts.onLoad?.(out.date, out.id);
						else if (out?.kind === 'unsupported') opts.onUnsupported?.(out);
					} catch (e) {
						opts.onError(e);
					}
				}
			} finally {
				await fh.close();
			}
		} catch (e) {
			opts.onError(e);
		} finally {
			busy = false;
		}
	}, intervalMs);
	return () => clearInterval(timer);
}

async function size(file: string): Promise<number> {
	try {
		return (await stat(file)).size;
	} catch {
		return 0; // not there yet: the game has not been started
	}
}
