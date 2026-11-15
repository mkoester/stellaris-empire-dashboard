import { distances } from '#lib/galaxyGraph.ts';
import { MARKET_RESOURCES } from '#lib/market.ts';
import { addGameDays } from '#lib/series.ts';
import type {
	BranchSite,
	Combat,
	Contract,
	DealSide,
	ExternalBuildings,
	GalacticCommunity,
	ResolutionVote,
	Snapshot,
	Subject,
	TradeDeal,
	War,
	WarSides
} from '#lib/types.ts';
import { galaxy, type GalaxyRaw, type RawSave } from '../save.ts';
import { colonyPlaces } from './colonies.ts';
import { capitalSystem, shipSystemId } from './fleets.ts';
import {
	countryIds,
	displayName,
	isYes,
	items,
	list,
	num,
	numOrNull,
	type Raw,
	strOrNull
} from './values.ts';

// Save → Snapshot: other empires — wars, the Galactic Community, subjects, contracts and trade
// deals (../save.ts; paths in docs/save-format.md).

/**
 * Wars the country takes part in: `war.<id> = { name start_date attackers = { { country call_type }
 * } defenders battles = { { attackers = { <ids> } defenders attacker_victory attacker_losses
 * defender_losses system date type } } attacker_war_goal = { type } defender_war_goal
 * attacker_war_exhaustion defender_war_exhaustion }` (4.5.2, first seen 2026-10-19). A war that
 * ended leaves `<id>=none`.
 */
export function wars(raw: Pick<RawSave, 'wars' | 'countryId' | 'countryNames' | 'systems'>): War[] {
	const side = (v: Raw) => items(v).map((p) => Number(p?.country));
	const named = (ids: number[]) => ids.map((c) => raw.countryNames[String(c)] ?? `empire ${c}`);
	return Object.entries(raw.wars).flatMap(([id, w]) => {
		if (!w || typeof w !== 'object') return [];
		const [attackers, defenders] = [side(w.attackers), side(w.defenders)];
		if (!attackers.includes(raw.countryId) && !defenders.includes(raw.countryId)) return [];
		const attacker = attackers.includes(raw.countryId);
		const [ours, theirs] = attacker ? [attackers, defenders] : [defenders, attackers];
		const [own, enemy] = attacker ? ['attacker', 'defender'] : ['defender', 'attacker'];
		return [
			{
				id,
				name: displayName(w.name) || `war ${id}`,
				start: strOrNull(w.start_date),
				enemies: named(theirs),
				allies: named(ours.filter((c) => c !== raw.countryId)),
				attacker,
				goal: strOrNull(w[`${own}_war_goal`]?.type),
				enemyGoal: strOrNull(w[`${enemy}_war_goal`]?.type),
				exhaustion: numOrNull(w[`${own}_war_exhaustion`]),
				enemyExhaustion: numOrNull(w[`${enemy}_war_exhaustion`]),
				battles: items(w.battles).map((b) => {
					// A battle's side lists name each other: in our first war we attacked their civilian
					// ships and won every battle (the user, 2026-10-19), and the save had `defenders =
					// { us } attacker_victory=yes defender_losses=4` — 4 of theirs. The losses and the
					// victory follow the roles, not the lists.
					const weAttacked = items(b?.defenders).some((c) => ours.includes(Number(c)));
					const attackerWon = b?.attacker_victory === true || b?.attacker_victory === 'yes';
					return {
						date: String(b?.date ?? ''),
						system: displayName(raw.systems[String(b?.system)]?.name),
						type: String(b?.type ?? ''),
						won: weAttacked === attackerWon,
						lost: Number((weAttacked ? b?.attacker_losses : b?.defender_losses) ?? 0),
						killed: Number((weAttacked ? b?.defender_losses : b?.attacker_losses) ?? 0)
					};
				})
			}
		];
	});
}

/** Every war being fought, by its sides (the diplomacy tab). */
export function allWars(raw: Pick<RawSave, 'wars'>): WarSides[] {
	const side = (v: Raw) => items(v).map((p) => Number(p?.country));
	return Object.entries(raw.wars).flatMap(([id, w]) =>
		w && typeof w === 'object'
			? [
					{
						id,
						name: displayName(w.name) || `war ${id}`,
						start: strOrNull(w.start_date),
						attackers: side(w.attackers),
						defenders: side(w.defenders)
					}
				]
			: []
	);
}

/**
 * The Galactic Community, or null before it forms: `galactic_community = { members = { <ids> }
 * proposed = { <resolution ids> } voting = <resolution id> passed = { <ids in force> } last
 * category_timers community_formed }` (passed: first seen 2212.03, The Readied Shield), the resolutions
 * `resolution.<id> = { type country supporters = { <ids> } opponents }` (4.5.2, first seen
 * 2026-10-19: one being voted on, seven proposed).
 */
export function galacticCommunity(
	raw: Pick<
		RawSave,
		'galcom' | 'resolutions' | 'countryId' | 'countries' | 'date' | 'countryBlocks' | 'globalFlags'
	>
): GalacticCommunity | null {
	const g = raw.galcom;
	if (!g || typeof g !== 'object' || g.members === undefined) return null;
	const ids = (v: Raw) => items(v).map(Number);
	const name = (id: number) => raw.countries[String(id)]?.name ?? `empire ${id}`;
	const vote = (id: number): ResolutionVote | null => {
		const r = raw.resolutions[String(id)];
		if (!r || typeof r !== 'object') return null;
		const [support, oppose] = [ids(r.supporters), ids(r.opponents)];
		return {
			id,
			type: String(r.type ?? ''),
			proposer: name(Number(r.country)),
			support: support.map(name),
			oppose: oppose.map(name),
			ours: support.includes(raw.countryId)
				? 'for'
				: oppose.includes(raw.countryId)
					? 'against'
					: null
		};
	};
	const members = ids(g.members);
	return {
		formed: strOrNull(g.community_formed),
		members: members.map(name),
		member: members.includes(raw.countryId),
		categoryTimers: Object.fromEntries(
			Object.entries(g.category_timers ?? {}).flatMap(([k, v]) =>
				typeof v === 'string' ? [[k, v]] : []
			)
		),
		globalFlags: Object.keys(raw.globalFlags ?? {}),
		weights: Object.fromEntries(
			members.map((id) => {
				const c = raw.countryBlocks[String(id)];
				const exact = numOrNull(c?.variables?.sdash_dw);
				return [
					name(id),
					exact === null
						? { value: estimatedWeight(c), exact: false }
						: { value: exact, exact: true }
				];
			})
		),
		voting: typeof g.voting === 'number' ? vote(g.voting) : null,
		proposed: ids(g.proposed).flatMap((id) => vote(id) ?? []),
		passed: ids(g.passed).flatMap((id) => vote(id) ?? []),
		// `days` counts up while a resolution is on the floor, to RESOLUTION_VOTE_TIMER; `cooldown`
		// counts the recess down (2213.12–2214.01: days 1411 on 12.01, passed 12.30, cooldown 719)
		voteEnds:
			typeof g.voting === 'number' && typeof g.days === 'number'
				? addGameDays(raw.date, VOTE_DAYS - g.days)
				: null,
		nextVote:
			typeof g.cooldown === 'number' && g.cooldown > 0 ? addGameDays(raw.date, g.cooldown) : null
	};
}

/**
 * A country's diplomatic weight, roughly: the defines' terms (4.5.2 `00_defines.txt`
 * `DIPLOMACY_WEIGHT_*`: naval power × 0.025 + economy power × 0.15 + technology × 0.1) scaled by
 * `WEIGHT_SCALE`, which stands in for what the save cannot give — the pops' share and every
 * `diplomatic_weight` modifier. Checked 2214.01.01 against the game's Galactic Community screen
 * (screenshots 2026_10_23_1–4, all 13 members): game ÷ defines' terms 1.0–3.3, median 2.6; a
 * linear fit with pops did no better (off by up to 227 of 138–643). Only companion mod 0.4.0's
 * exported value is exact.
 */
const WEIGHT_SCALE = 2.6;
export function estimatedWeight(c: Raw): number {
	return (
		WEIGHT_SCALE *
		(num(c?.military_power) * 0.025 + num(c?.economy_power) * 0.15 + num(c?.tech_power) * 0.1)
	);
}

/** Days a resolution stays on the senate floor (RESOLUTION_VOTE_TIMER, 4.5.2). */
const VOTE_DAYS = 1440;

/**
 * Our fleets' last combats: `fleet.<id>.fleet_stats.combat_stats = { fleet = { country_name
 * fleet_name ship_size_count = { <per size> } ship_size_count_lost … } date enemy = { { …the same…
 * } } damage_outgoing damage_incoming }`. Every fleet has the block, `date="0.01.01"` until it
 * fights, and the game clears it again later (2205.10.14's was in the 11.01 save, gone by 12.01):
 * monthly saves catch only some combats, and the losses as of the save.
 */
export function combats(raw: Pick<RawSave, 'country' | 'fleets'>): Combat[] {
	const sum = (v: Raw) => items(v).reduce((n: number, x) => n + Number(x || 0), 0);
	return items(raw.country?.fleets_manager?.owned_fleets).flatMap((o) => {
		const c = raw.fleets[String(o?.fleet)]?.fleet_stats?.combat_stats;
		if (!c || typeof c.date !== 'string' || c.date.startsWith('0.')) return [];
		const enemies = items(c.enemy);
		const names = (k: string) => [...new Set(enemies.map((e) => String(e?.[k] ?? '?')))].join(', ');
		return [
			{
				fleetId: Number(o.fleet),
				fleet: String(c.fleet?.fleet_name ?? `fleet ${o.fleet}`),
				date: c.date,
				enemy: names('country_name'),
				enemyFleets: names('fleet_name'),
				ships: sum(c.fleet?.ship_size_count),
				lost: sum(c.fleet?.ship_size_count_lost),
				enemyShips: enemies.reduce((n, e) => n + sum(e?.ship_size_count), 0),
				enemyLost: enemies.reduce((n, e) => n + sum(e?.ship_size_count_lost), 0)
			}
		];
	});
}

/** Our active subject agreements, as overlord or as subject (see `Subject`). */
export function subjects(
	raw: Pick<
		RawSave,
		'agreements' | 'countryId' | 'countries' | 'loyalty' | 'countryBlocks' | 'wars'
	>
): Subject[] {
	const pairs = (v: Raw) => items(v).filter((x) => typeof x?.key === 'string');
	return Object.values(raw.agreements).flatMap((a) => {
		if (!a || typeof a !== 'object' || a.active_status !== 'active') return [];
		const [owner, target] = [Number(a.owner), Number(a.target)];
		if (owner !== raw.countryId && target !== raw.countryId) return [];
		const other = owner === raw.countryId ? target : owner;
		const t = a.term_data ?? {};
		return [
			{
				countryId: other,
				name: raw.countries[String(other)]?.name ?? `empire ${other}`,
				weAreOverlord: owner === raw.countryId,
				preset: String(t.agreement_preset ?? ''),
				since: strOrNull(a.date_added),
				terms: Object.fromEntries(pairs(t.discrete_terms).map((x) => [x.key, String(x.value)])),
				subsidies: Object.fromEntries(
					pairs(t.resource_terms).map((x) => [x.key, Number(x.value) || 0])
				),
				specialistLevel: Number(a.subject_specialization?.level ?? 0),
				specialistExperience: Number(a.subject_specialization?.experience ?? 0),
				loyalty: raw.loyalty[String(target)] ?? null,
				changed: strOrNull(a.date_changed),
				firstCooldown:
					t.has_cooldown_on_first_renegotiation === undefined
						? null
						: isYes(t.has_cooldown_on_first_renegotiation),
				conversion: conversionOf(a.subject_specialization?.subject_conversion_process),
				...subjectState(raw.countryBlocks[String(other)], raw.countryId, other, raw.wars)
			}
		];
	});
}

function conversionOf(p: Raw): Subject['conversion'] {
	if (!p || typeof p !== 'object') return null;
	return { progress: num(p.progress), inProgress: isYes(p.in_progress), done: isYes(p.done) };
}

/** A subject's stance and numbers from its own country block (see `SubjectStance`). */
export function subjectState(
	c: Raw,
	us: number,
	id: number,
	wars: RawSave['wars']
): Pick<Subject, 'stance' | 'power'> {
	if (!c || typeof c !== 'object') return { stance: null, power: null };
	const toUs = items(c.relations_manager?.relation).find((r) => r?.country === us);
	const fighting = Object.values(wars).flatMap((w) => {
		if (!w || typeof w !== 'object') return [];
		const sides = [...items(w.attackers), ...items(w.defenders)].map((x) => Number(x?.country));
		return sides.includes(id) ? [displayName(w.name)] : [];
	});
	return {
		stance: {
			opinion: numOrNull(toUs?.relation_current),
			trust: numOrNull(toUs?.trust),
			inBreach: isYes(c.is_in_breach_of_any),
			policies: Object.fromEntries(
				items(c.active_policies)
					.filter((p) => typeof p?.policy === 'string')
					.map((p) => [String(p.policy), String(p.selected ?? '')])
			),
			wars: fighting
		},
		power: {
			military: numOrNull(c.military_power),
			economy: numOrNull(c.economy_power),
			tech: numOrNull(c.tech_power),
			fleetSize: numOrNull(c.fleet_size),
			navalUsed: numOrNull(c.used_naval_capacity),
			empireSize: numOrNull(c.empire_size),
			pops: numOrNull(c.num_sapient_pops),
			colonies: items(c.controlled_colonies).length,
			victoryRank: numOrNull(c.victory_rank)
		}
	};
}

/**
 * Branch offices and holdings (`colony.<id>.externally_owned_buildings`; first seen 2026-11-01 in
 * the Planetforgers' 2214.02.01 save: an AI MegaCorp's office with Corporate Clinics on a nomad's
 * arkship), those we hold and those on our colonies; and, for a MegaCorp, every other empire's
 * colony with trade as a site for one (`branchSites`), jumps from our capital.
 */
export function externalBuildings(
	raw: Pick<
		RawSave,
		| 'countryId'
		| 'country'
		| 'colonies'
		| 'planets'
		| 'ships'
		| 'fleets'
		| 'fleetOwner'
		| 'buildings'
		| 'countries'
		| 'systems'
	> &
		Partial<GalaxyRaw>
): Pick<Snapshot, 'external' | 'branchSites'> {
	const us = raw.countryId;
	const name = (id: number) => raw.countries[String(id)]?.name ?? `empire ${id}`;
	const places = colonyPlaces(raw);
	const colonyFacts = (id: string, c: Raw) => {
		const place = places.get(Number(id));
		if (!place) return null;
		const [placeId, body] = place;
		const ship = placeId < 0;
		const ownerRaw = ship ? raw.fleetOwner[String(body?.fleet)] : body?.owner;
		if (ownerRaw === undefined) return null;
		const systemId = ship ? shipSystemId(raw, -1 - placeId) : body?.coordinate?.origin;
		const trade = c?.produces?.trade;
		return {
			colonyId: Number(id),
			name: displayName(body?.name) || `colony ${id}`,
			systemId: systemId === undefined || systemId === null ? null : Number(systemId),
			ownerId: Number(ownerRaw),
			owner: name(Number(ownerRaw)),
			trade: typeof trade === 'number' ? trade : null
		};
	};
	const external: ExternalBuildings[] = [];
	const offices = new Map<number, string>(); // colony → the corporation with an office there
	const facts = new Map<string, ReturnType<typeof colonyFacts>>();
	for (const [id, c] of Object.entries(raw.colonies ?? {})) {
		const entries = items(c?.externally_owned_buildings);
		if (!entries.length) continue;
		const f = colonyFacts(id, c);
		facts.set(id, f);
		if (!f) continue;
		for (const e of entries) {
			const holderId = Number(e?.building_owner);
			const kind = e?.owner_type === 'subject_holding' ? 'subject_holding' : 'corporate';
			if (kind === 'corporate') offices.set(f.colonyId, name(holderId));
			if (holderId !== us && f.ownerId !== us) continue;
			external.push({
				...f,
				holderId,
				holder: name(holderId),
				kind,
				buildings: list(e?.buildings)
					.map((b) => strOrNull(raw.buildings[String(b)]?.type))
					.filter((t): t is string => t !== null)
			});
		}
	}
	if (raw.country?.government?.authority !== 'auth_corporate')
		return { external, branchSites: null };
	const capital = capitalSystem(raw);
	const jumps = capital === null ? null : distances(galaxy(raw), [capital]).jumps;
	const branchSites: BranchSite[] = Object.entries(raw.colonies ?? {}).flatMap(([id, c]) => {
		const f = facts.get(id) ?? colonyFacts(id, c);
		if (!f || f.ownerId === us || !f.trade || raw.countries[String(f.ownerId)]?.type !== 'default')
			return [];
		return [
			{
				colonyId: f.colonyId,
				name: f.name,
				systemId: f.systemId,
				ownerId: f.ownerId,
				owner: f.owner,
				trade: f.trade,
				jumps: f.systemId === null ? null : (jumps?.get(f.systemId) ?? null),
				office: offices.get(f.colonyId) ?? null
			}
		];
	});
	return { external, branchSites };
}

/**
 * Trade deals with the country on one side. UNVERIFIED — `trade_deal` was empty in every save seen
 * (ours to 2207, a 4.0.1 one at 2312). Known from stellaris-dashboard's parser: `trade_deal.<id> =
 * { first = { country … } second = { country sensor_link=yes … } date length }` (length in years).
 * Guessed: each side lists what it gives (loc `TRADE_DEAL_DESC`: "$FIRST$ will trade:
 * $FIRST_OFFER$"), resources under a key with "month" in it are monthly. A deal whose sides are not
 * found keeps everything in `gives.other`, and is logged.
 */
/**
 * Every contract in the galaxy: the missions `contracts.available` (offers) and `in_progress`
 * list. Planetforgers 2214.02.01: `missions.23 = { mission="contract_colony_startup" days_left=1025
 * location={ type=4 id=383 } operator=4294967295 issuer=16777227 }`; accepted ones carry
 * `accepted_date` and `status=active`, internal ones (Eternal Chorus) operator = issuer.
 */
const NO_ID = 4294967295; // the save's "none" for an id

export function contracts(
	raw: Pick<RawSave, 'missions' | 'contractIds' | 'countryBlocks'>
): Contract[] {
	const name = (id: number) => displayName(raw.countryBlocks[String(id)]?.name) || `empire ${id}`;
	const ids = [
		...items(raw.contractIds?.available).map((id) => [Number(id), 'offered'] as const),
		...items(raw.contractIds?.in_progress).map((id) => [Number(id), 'active'] as const)
	];
	return ids.flatMap(([id, listed]) => {
		const m = raw.missions[String(id)];
		if (!m || typeof m !== 'object' || typeof m.mission !== 'string') return [];
		const operator = typeof m.operator === 'number' && m.operator !== NO_ID ? m.operator : null;
		const issuer = Number(m.issuer);
		return [
			{
				id,
				key: m.mission,
				issuer,
				issuerName: name(issuer),
				operator,
				operatorName: operator === null ? null : name(operator),
				systemId:
					m.location?.type === 4 && typeof m.location.id === 'number' ? m.location.id : null,
				state: listed,
				daysLeft: numOrNull(m.days_left),
				accepted: typeof m.accepted_date === 'string' ? m.accepted_date : null
			}
		];
	});
}

export function tradeDeals(
	raw: Pick<RawSave, 'tradeDeals' | 'countryId' | 'countryNames'>
): TradeDeal[] {
	return Object.entries(raw.tradeDeals).flatMap(([id, d]) => {
		const sides = countryIds(d);
		if (!sides.includes(raw.countryId)) return [];
		const others = sides.filter((c) => c !== raw.countryId);
		const own = [d?.first, d?.second].find((x) => Number(x?.country) === raw.countryId);
		const theirs = [d?.first, d?.second].find((x) => x && x !== own && x.country !== undefined);
		const understood = own !== undefined && theirs !== undefined;
		if (!understood) console.warn(`trade deal ${id} not understood, check its shape:`, d);
		return [
			{
				id,
				partner: others.map((c) => raw.countryNames[String(c)] ?? `empire ${c}`).join(', '),
				start: typeof d?.date === 'string' ? d.date : null,
				years: typeof d?.length === 'number' && d.length > 0 ? d.length : null,
				gives: dealSide(understood ? own : d),
				gets: dealSide(understood ? theirs : undefined),
				understood,
				raw: JSON.stringify(d).slice(0, 2000)
			}
		];
	});
}

const RESOURCE_KEYS = new Set(MARKET_RESOURCES);

/** One side's offer, read generically: resource amounts by key, `{ resource amount }` pairs too. */
export function dealSide(v: Raw): DealSide {
	const side: DealSide = { monthly: {}, once: {}, other: [] };
	const add = (path: string[], resource: string, amount: number) => {
		const into = path.some((p) => p.includes('month')) ? side.monthly : side.once;
		into[resource] = (into[resource] ?? 0) + amount;
	};
	const walk = (x: Raw, path: string[]) => {
		if (x && typeof x === 'object') {
			if (typeof x.resource === 'string' && typeof x.amount === 'number')
				return add(path, x.resource, x.amount);
			for (const [k, y] of Object.entries(x)) {
				if (k === 'country' || k === 'recipient') continue;
				walk(y, Array.isArray(x) ? path : [...path, k]);
			}
			return;
		}
		const key = path.at(-1) ?? '';
		if (typeof x === 'number' && RESOURCE_KEYS.has(key)) add(path.slice(0, -1), key, x);
		else if (x !== 'no' && x !== false && x !== undefined)
			side.other.push(x === 'yes' || x === true ? path.join(' ') : `${path.join(' ')} ${x}`);
	};
	walk(v, []);
	return side;
}
