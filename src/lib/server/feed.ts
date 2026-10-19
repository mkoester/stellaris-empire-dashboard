import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import type { Resources, Snapshot } from '#lib/types.ts';

// Reads the companion mod's lines from game.log (mod/dashboard_feed, sdash_scripted_effects.txt):
//   SDASH|1|<date>|<resource>|<stockpile>|<monthly income>   one per resource
//   SDASH|1|<date>|end                                        month complete
// game.log prefixes each line with "[time][file:line]: "; everything before "SDASH|" is ignored.

export type Month = { date: string; stockpile: Resources; balance: Resources };

export type Line =
	| { kind: 'resource'; date: string; resource: string; stockpile: number; income: number }
	| { kind: 'end'; date: string };

/** Parses one log line; null for unrelated lines, throws on a malformed SDASH line. */
export function parseLine(raw: string): Line | null {
	const at = raw.indexOf('SDASH|');
	if (at < 0) return null;
	const [, version, rawDate, ...rest] = raw.slice(at).trim().split('|');
	if (version !== '1') throw new Error(`unknown SDASH format ${version}: ${raw}`);
	const date = gameDate(rawDate);
	if (rest.length === 1 && rest[0] === 'end') return { kind: 'end', date };
	const [resource, stockpile, income] = rest;
	const s = Number(stockpile);
	const i = Number(income);
	if (rest.length !== 3 || !resource || !Number.isFinite(s) || !Number.isFinite(i)) {
		throw new Error(`malformed SDASH line: ${raw}`);
	}
	return { kind: 'resource', date, resource, stockpile: s, income: i };
}

/** "2200.1.1" or "2200.01.01" → "2200.01.01", the form saves use. */
function gameDate(raw: string): string {
	const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(raw ?? '');
	if (!m) throw new Error(`unexpected date format in SDASH line: ${raw}`);
	return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

/** Collects resource lines per date; returns a month when its end marker arrives. */
export function assembler() {
	const months = new Map<string, Month>();
	return (line: Line): Month | null => {
		const month = months.get(line.date) ?? { date: line.date, stockpile: {}, balance: {} };
		if (line.kind === 'end') {
			months.delete(line.date);
			return month;
		}
		month.stockpile[line.resource] = line.stockpile;
		month.balance[line.resource] = line.income;
		months.set(line.date, month);
		return null;
	};
}

/** A month from the log as a (partial) snapshot of the campaign being played. */
export function toLogSnapshot(m: Month, campaign: string): Snapshot {
	return {
		kind: 'log',
		campaign,
		date: m.date,
		fingerprint: monthFingerprint(m),
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
		envoys: null,
		marketOrders: [],
		market: null,
		leaders: null,
		ships: null,
		defaultAutomation: null,
		automationBlocked: null,
		planetBudget: null,
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
		speciesRights: null
	};
}

export function monthFingerprint(m: Month): string {
	const body = JSON.stringify([m.date, Object.entries(m.stockpile).sort()]);
	return `log:${createHash('sha1').update(body).digest('hex').slice(0, 16)}`;
}

export type TailOptions = {
	onMonth: (m: Month) => void;
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
						const month = line && add(line);
						if (month) opts.onMonth(month);
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
