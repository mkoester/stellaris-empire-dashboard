import type { CouncilSeat, LeaderInfo, PoolLeader } from '#lib/types.ts';
import type { RawSave } from '../save.ts';
import { colonyPlaces } from './colonies.ts';
import { displayName, items, list, num, numOrNull, type Raw, strOrNull } from './values.ts';

// Save → Snapshot: leaders, the council and the ruler (../save.ts; paths in docs/save-format.md).

type LeaderRaw = Pick<RawSave, 'country' | 'leaders' | 'speciesDb' | 'councilPositions'> &
	Partial<Pick<RawSave, 'colonies' | 'planets' | 'ships' | 'fleets' | 'date'>>;

/**
 * A leader's age: `age`, or for one still in the recruitment pool (`age=0`) the years since its
 * `date` — 2171.01.01 for a leader the game showed as 33 on 2204.10 (Recruitable Leaders, 4.5.3).
 */
function leaderAge(l: Raw, now: string | undefined): number | null {
	const age = numOrNull(l.age);
	const born = strOrNull(l.date);
	if (age || !born || !now || born >= now) return age;
	const [y, m, d] = born.split('.').map(Number);
	const [ny, nm, nd] = now.split('.').map(Number);
	return ny - y - (nm * 100 + nd < m * 100 + d ? 1 : 0);
}

/**
 * A leader as the leaders tab shows it, by the save's `leaders.<id>`: what it holds — the council
 * (`country.government.council_positions`), the rule, a colony (`colony.<id>.governor`,
 * 2026-10-30) — and where it is assigned (`location = { type id }`: a ship → that ship's fleet, a
 * commander's or a science ship's, 2204.11; an army). A councilor's `location` is a planet, the
 * capital's (not an assignment).
 */
function leaderInfos(raw: LeaderRaw) {
	const { planets, colonies, ships } = raw;
	const places = planets && colonies && ships ? colonyPlaces({ planets, colonies, ships }) : null;
	const governs = new Map<number, string | null>();
	const governsPlace = new Map<number, number>(); // leader → its colony's place (colonyPlaces' id)
	for (const c of list(raw.country?.controlled_colonies)) {
		const leader = numOrNull(raw.colonies?.[String(c)]?.governor);
		const place = places?.get(Number(c));
		if (leader !== null) governs.set(leader, place ? displayName(place[1].name) : null);
		if (leader !== null && place) governsPlace.set(leader, place[0]);
	}
	// a leader's home, `background_planet = { type=planet|ship reference }` (4.5.3; a number: a
	// planet), as colonyPlaces' id — a ship's −1 − its id — and its name
	const home = (l: Raw): { place: number; name: string | null } | null => {
		const b = l.background_planet;
		const type = typeof b === 'number' ? 'planet' : strOrNull(b?.type);
		const ref = typeof b === 'number' ? b : numOrNull(b?.reference);
		if (ref === null || (type !== 'planet' && type !== 'ship')) return null;
		const at = type === 'planet' ? raw.planets?.[String(ref)] : raw.ships?.[String(ref)];
		return {
			place: type === 'planet' ? ref : -1 - ref,
			name: at && typeof at === 'object' ? displayName(at.name) : null
		};
	};
	const seated = new Set(
		list(raw.country?.government?.council_positions).map((id) =>
			numOrNull(raw.councilPositions[String(id)]?.leader)
		)
	);
	const rulerId = numOrNull(raw.country?.ruler);
	const assigned = (loc: Raw): LeaderInfo['assigned'] => {
		const type = strOrNull(loc?.type);
		if (!type || type === 'planet' || type === 'none') return null;
		if (type === 'ship') {
			const fleet = raw.fleets?.[String(raw.ships?.[String(loc.id)]?.fleet)];
			return { kind: 'fleet', name: fleet ? displayName(fleet.name) : null };
		}
		return { kind: type, name: null };
	};
	return (id: number): LeaderInfo | null => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object') return null;
		const sp = raw.speciesDb[String(l.species)];
		return {
			id,
			name: leaderName(l.name),
			class: String(l.class),
			level: num(l.level),
			bonus: num(l.bonus_skill_level),
			experience: numOrNull(l.experience),
			// `immortal=yes` assumed (no immortal leader seen in a 4.5.3 save yet), else mortal
			immortal: l.immortal === 'yes' || l.immortal === true,
			age: leaderAge(l, raw.date),
			traits: items(l.traits).map(String),
			job: strOrNull(l.job),
			species: sp ? displayName(sp.name) : null,
			council: seated.has(id),
			ruler: id === rulerId,
			ethic: strOrNull(l.ethic),
			governor: governs.has(id),
			governs: governs.get(id) ?? null,
			home: home(l)?.name ?? null,
			governsHome: governsPlace.has(id) ? governsPlace.get(id) === home(l)?.place : null,
			assigned: assigned(l.location)
		};
	};
}

/** Every hired leader (`country.owned_leaders`), with its traits and what it holds. */
export function leaderList(raw: LeaderRaw): LeaderInfo[] {
	const info = leaderInfos(raw);
	return list(raw.country?.owned_leaders).flatMap((id) => info(Number(id)) ?? []);
}

/**
 * The recruitable leaders: `country.modules.standard_leader_module.leaders` (4.5.3, 2204.10.01:
 * 4 officials, 3 commanders, 3 scientists — not in `owned_leaders`), each with `date_added`, the
 * day the pool was filled (2200.01.01, the game showing "Refreshes 2205.01.01").
 */
export function leaderPool(raw: LeaderRaw): PoolLeader[] {
	const info = leaderInfos(raw);
	return list(raw.country?.modules?.standard_leader_module?.leaders).flatMap((id) => {
		const l = info(Number(id));
		return l ? [{ ...l, added: strOrNull(raw.leaders[String(id)].date_added) }] : [];
	});
}

/**
 * The council's seats, in the order `country.government.council_positions` lists them, from the
 * top-level `council_positions` (2207.03.10: defense, research, state; the ruler is apart).
 */
export function council(
	raw: Pick<RawSave, 'country' | 'councilPositions' | 'leaders'>
): CouncilSeat[] {
	return list(raw.country?.government?.council_positions).flatMap((id) => {
		const p = raw.councilPositions[String(id)];
		if (!p || typeof p !== 'object') return [];
		const leaderId = numOrNull(p.leader);
		const l = leaderId === null ? undefined : raw.leaders[String(leaderId)];
		return [
			{
				type: String(p.type),
				leaderId: l && typeof l === 'object' ? leaderId : null,
				leaderName: l && typeof l === 'object' ? leaderName(l.name) : null,
				leaderLevel: l && typeof l === 'object' ? numOrNull(l.level) : null,
				leaderBonus: l && typeof l === 'object' ? num(l.bonus_skill_level) : 0,
				leaderTraits: l && typeof l === 'object' ? items(l.traits).map(String) : []
			}
		];
	});
}

/**
 * The country's leaders: `country.owned_leaders`. Filtering `leaders` by `country` would also
 * count the recruitment pool (19 instead of 7 at 2200.05).
 */
export function ownLeaders(raw: Pick<RawSave, 'country' | 'leaders'>): Raw[] {
	return list(raw.country?.owned_leaders)
		.map((id) => raw.leaders[String(id)])
		.filter((l) => l && typeof l === 'object');
}

/**
 * Hired leaders without a post: no `location` (ship, planet, envoy assignment) and no
 * `council_location`. The ruler sits in neither and is left out; so are envoys (see envoys()).
 */
export function idleLeaders(raw: Pick<RawSave, 'country' | 'leaders'>) {
	return list(raw.country?.owned_leaders).flatMap((id) => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object' || l.class === 'envoy' || id === num(raw.country?.ruler))
			return [];
		if (l.location !== undefined || l.council_location !== undefined) return [];
		return [{ id, class: String(l.class), name: leaderName(l.name) }];
	});
}

/** Every hired leader (`country.owned_leaders` → `leaders.<id>`), envoys and the ruler included. */
export function leaderRoster(raw: Pick<RawSave, 'country' | 'leaders'>) {
	return list(raw.country?.owned_leaders).flatMap((id) => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object') return [];
		return [{ id, class: String(l.class), name: leaderName(l.name) }];
	});
}

export function ruler(raw: Pick<RawSave, 'country' | 'leaders'>) {
	const id = num(raw.country?.ruler);
	const l = raw.leaders[String(id)];
	if (!l || typeof l !== 'object') return null;
	return {
		id,
		name: leaderName(l.name),
		...(typeof l.level === 'number'
			? { level: l.level, bonus: num(l.bonus_skill_level), traits: items(l.traits).map(String) }
			: {})
	};
}

/** `name = { full_names = { key=… } }` (or a list of parts) → "Mncedisi Iweala". */
export function leaderName(name: Raw): string {
	const full = name?.full_names ?? name;
	const parts = Array.isArray(full) ? full : [full];
	return parts
		.map((p) => displayName(p))
		.filter(Boolean)
		.join(' ');
}

/** A leader's skill: `level` + `bonus_skill_level`; 0 without a leader. */
export const leaderSkill = (l: Raw) =>
	l && typeof l === 'object' ? num(l.level) + num(l.bonus_skill_level) : 0;
