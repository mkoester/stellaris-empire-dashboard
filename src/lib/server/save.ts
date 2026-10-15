import { Jomini } from 'jomini';
import type { Colony, Resources, Snapshot } from '#lib/types.ts';
import { START_YEAR } from '#lib/series.ts';
import { readZipEntry } from './zip.ts';

// Save → Snapshot. `querySave` is the only part touching jomini; everything after it is pure and
// takes plain objects, so it is unit-tested against hand-written fixtures.
// Paths into the gamestate are documented in AGENTS.md ("Save format facts").

// jomini returns untyped JS values; this is the subset of the gamestate we read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export type RawSave = {
	date: string;
	tick: number;
	randomCount: number;
	countryId: number;
	country: Raw;
	colonies: Record<string, Raw>;
	planets: Record<string, Raw>;
	empireName: string;
	endGameStart: number | null; // galaxy.end_game_start: years after the 2200.01.01 start
};

let parser: Promise<Jomini> | undefined;

export async function readSave(zip: Uint8Array): Promise<RawSave> {
	const jomini = await (parser ??= Jomini.initialize());
	const opts = { typeNarrowing: 'unquoted' as const };
	const meta = jomini.parseText(readZipEntry(zip, 'meta'), opts);
	return jomini.parseText(readZipEntry(zip, 'gamestate'), opts, (q) => {
		const countryId = Number(first(q.at('/player'))?.country ?? 0);
		return {
			date: String(q.at('/date')),
			tick: Number(q.at('/tick') ?? 0),
			randomCount: Number(q.at('/random_count') ?? 0),
			countryId,
			country: q.at(`/country/${countryId}`),
			colonies: q.at('/colony') ?? {},
			planets: q.at('/planets/planet') ?? {},
			empireName: String(meta.name ?? ''),
			endGameStart: numOrNull(q.at('/galaxy/end_game_start'))
		};
	});
}

export function toSnapshot(raw: RawSave, campaign: string): Snapshot {
	const budget = raw.country?.budget?.current_month ?? {};
	return {
		kind: 'save',
		campaign,
		date: raw.date,
		fingerprint: `${raw.tick}:${raw.randomCount}`,
		countryId: raw.countryId,
		empireName: raw.empireName,
		pops: num(raw.country?.num_sapient_pops),
		stockpile: resources(raw.country?.modules?.standard_economy_module?.resources),
		income: sumSources(budget.income),
		expenses: sumSources(budget.expenses),
		balance: sumSources(budget.balance),
		colonies: playerColonies(raw),
		endGameYear: raw.endGameStart === null ? null : START_YEAR + raw.endGameStart,
		empireSize: numOrNull(raw.country?.empire_size),
		starbases:
			typeof raw.country?.starbase_capacity === 'number'
				? { used: num(raw.country.starbase_capacity_used), capacity: raw.country.starbase_capacity }
				: null,
		navalUsed: numOrNull(raw.country?.used_naval_capacity)
	};
}

function playerColonies(raw: RawSave): Colony[] {
	const planetOfColony = new Map<number, [number, Raw]>();
	for (const [id, planet] of Object.entries(raw.planets)) {
		if (planet && typeof planet === 'object' && planet.colony !== undefined) {
			planetOfColony.set(Number(planet.colony), [Number(id), planet]);
		}
	}
	return list(raw.country?.controlled_colonies).map((colonyId) => {
		const c = raw.colonies[String(colonyId)] ?? {};
		const [planetId, planet] = planetOfColony.get(colonyId) ?? [-1, undefined];
		return {
			planetId,
			name: planet ? displayName(planet.name) : `colony ${colonyId}`,
			designation: String(c.final_designation ?? ''),
			pops: num(c.num_sapient_pops),
			employablePops: num(c.employable_pops),
			stability: num(c.stability),
			freeHousing: num(c.free_housing),
			freeAmenities: num(c.free_amenities),
			districts: list(c.districts).length,
			buildQueueId: planet?.build_queue !== undefined ? Number(planet.build_queue) : null
		};
	});
}

/** Sums `{ <source>: { <resource>: n } }` into `{ <resource>: n }`. */
export function sumSources(bySource: Raw): Resources {
	const out: Resources = {};
	for (const res of Object.values(bySource ?? {})) {
		for (const [k, v] of Object.entries(resources(res))) out[k] = (out[k] ?? 0) + v;
	}
	return out;
}

/** Readable approximation of a localisation key: `SPEC_Dar-Hesh_planet` → `Dar-Hesh`. */
export function displayName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	if (key.startsWith('%') && Array.isArray(name?.variables)) {
		return name.variables.map((v: Raw) => displayName(v.value)).join(' ');
	}
	return key
		.replace(/^(SPEC|NAME|PRESCRIPTED)_/, '')
		.replace(/_(planet|system|star)$/, '')
		.replaceAll('_', ' ');
}

function resources(obj: Raw): Resources {
	const out: Resources = {};
	for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === 'number') out[k] = v;
	return out;
}

const num = (v: Raw) => (typeof v === 'number' ? v : 0);
const numOrNull = (v: Raw) => (typeof v === 'number' ? v : null);
const list = (v: Raw): number[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number);
const first = (v: Raw) => (Array.isArray(v) ? v[0] : v);
