import {
	anomalies,
	claims,
	digSites,
	storms,
	eventChains,
	diplomacy,
	firstContacts,
	galaxy as galaxySystems,
	knownCountries,
	ourIntel,
	relations,
	situations,
	specialProjects,
	stationsSeen
} from '../world.ts';
import { MARKET_RESOURCES } from '#lib/market.ts';
import { addGameDays } from '#lib/series.ts';
import { type EntryEvent, entryEventsFor, type SystemEntry } from '#lib/systemEvents.ts';
import type {
	AiIntel,
	BudgetSource,
	EthicsState,
	Faction,
	Market,
	MarketOrder,
	PlanetState,
	Progress,
	QueuedTech,
	Resources,
	Shroud,
	TimedModifier,
	Wanderlust
} from '#lib/types.ts';
import { WANDERLUST, wanderlustCategories } from '#lib/wanderlust.ts';
import type { RawSave } from '../save.ts';
import { allWars } from './diplomacy.ts';
import { ownSystems } from './fleets.ts';
import { speciesName } from './species.ts';
import {
	addResources,
	displayName,
	first,
	items,
	list,
	num,
	numOrNull,
	type Raw,
	resources,
	strOrNull,
	sumSources
} from './values.ts';

// Save → Snapshot: our country's own state — focus, modifiers, cooldowns, the market, intel,
// research, ethics and factions (../save.ts; paths in docs/save-format.md).

/**
 * How many players the save's `player = { { name country } … }` lists. **Only two or more say
 * multiplayer**: the name does not — the native Linux build writes the Steam account in single
 * player too (every save since the switch from Proton; the Proton build wrote "unknown"; found
 * 2026-11-12, when UNE 6 read as multiplayer), and so does Ironman. A multiplayer game hosted alone
 * (Oracularity of Noerm, one player named) is caught by the companion mod's monthly line only.
 */
export function playerCount(player: Raw): number {
	return items(player).length;
}

/**
 * `country.focus = { active = { <card ids> } priority = { current } reward = { rewards = { {
 * category current progress } } } }`; a card is `focus_cards.<id> = { type status }`, status 1
 * read as done (2207.03.10: 1 on Hire a Commander, Adopt a Tradition; 0 on Declare a Rival).
 */
export function empireFocus(raw: Pick<RawSave, 'country' | 'focusCards'>) {
	const f = raw.country?.focus;
	if (!f || typeof f !== 'object') return null;
	return {
		priority: strOrNull(f.priority?.current),
		cards: list(f.active).flatMap((id) => {
			const c = raw.focusCards[String(id)];
			return typeof c?.type === 'string' ? [{ key: c.type, done: c.status === 1 }] : [];
		}),
		rewards: items(f.reward?.rewards)
			.filter((r) => typeof r?.category === 'string')
			.map((r) => ({
				category: r.category,
				current: String(r.current ?? ''),
				progress: num(r.progress)
			}))
	};
}

const FLAG_EPOCH = 62808000; // a flag's value is the hour it was set: 2200.01.01 = 62808000, +24 a day

/**
 * The Wanderlust perk's progress (#lib/wanderlust.ts): per category `country.variables.<key>_
 * system_seen` / `_count` (4.5.3, 2204.10.01: 0 / 6 … 0 / 17, the counts 80 % of the flagged
 * systems) and the flag `<key>_completed`; the systems an arkship counted, by their star flag
 * `visited_by_nomad@<our id>` — **assumed spelling**, not yet seen in a save. Null without the perk.
 */
export function wanderlust(
	raw: Pick<RawSave, 'country' | 'countryId' | 'systems' | 'date'>
): Wanderlust | null {
	const vars = raw.country?.variables ?? {};
	const flags = Object.keys(raw.country?.flags ?? {});
	const complete = flags.includes('nomad_exploration_complete');
	const categories = WANDERLUST.filter(
		(c) => typeof vars[`${c.key}_system_count`] === 'number'
	).map((c) => ({
		key: c.key,
		seen: num(vars[`${c.key}_system_seen`]),
		count: num(vars[`${c.key}_system_count`]),
		done: flags.includes(`${c.key}_completed`)
	}));
	if (!categories.length && !complete) return null;
	const mark = `visited_by_nomad@${raw.countryId}`;
	const visits = Object.entries(raw.systems).flatMap(([id, sys]) => {
		const at = sys?.flags?.[mark];
		if (typeof at !== 'number') return [];
		return [
			{
				systemId: Number(id),
				system: displayName(sys.name),
				date: addGameDays('2200.01.01', Math.floor((at - FLAG_EPOCH) / 24)),
				categories: wanderlustCategories(Object.keys(sys.flags))
			}
		];
	});
	return { categories, visits, complete };
}

/** The galaxy and the others, as the empire knows them (server/world.ts). */
export function world(raw: RawSave) {
	const own = ownSystems(raw);
	const gal = galaxySystems(raw, own);
	const rel = relations(raw);
	const contacts = firstContacts(raw);
	const visited = new Set(gal.filter((s) => s.visited).map((s) => s.id));
	return {
		galaxy: gal,
		relations: rel,
		intel: ourIntel(raw),
		diplomacy: diplomacy(raw),
		allWars: allWars(raw),
		claims: claims(raw, own),
		firstContacts: contacts,
		countries: knownCountries(raw, [
			...rel.map((r) => r.countryId),
			...contacts.map((c) => c.countryId),
			...gal.flatMap((s) => (s.ownerId === null ? [] : [s.ownerId]))
		]),
		situations: situations(raw),
		anomalies: anomalies(raw),
		specialProjects: specialProjects(raw),
		digSites: digSites(raw, visited),
		storms: storms(raw),
		eventChains: eventChains(raw),
		stationsSeen: stationsSeen(raw, own)
	};
}

/** `country.edicts = { { edict date start_date perpetual } }`; a perpetual one's `date` is junk. */
export function edictTimes(edicts: Raw) {
	return items(edicts)
		.filter((e) => typeof e?.edict === 'string')
		.map((e) => ({
			key: String(e.edict),
			start: strOrNull(e.start_date),
			end: e.perpetual === true || e.perpetual === 'yes' ? null : strOrNull(e.date)
		}));
}

/**
 * `country.timed_modifier = { items = { { modifier="celebrate_diversity" days=3535 } … } }` —
 * `days` left, −1 for a permanent one.
 */
export function countryModifiers(raw: Pick<RawSave, 'country' | 'date'>): TimedModifier[] {
	return timedModifiers(raw.country?.timed_modifier, raw.date);
}

/** A `timed_modifier` block (country or planet) with end dates. */
function timedModifiers(block: Raw, date: string): TimedModifier[] {
	return items(block?.items)
		.filter((m) => typeof m?.modifier === 'string')
		.map((m) => ({
			key: m.modifier,
			until: typeof m.days === 'number' && m.days > 0 ? addGameDays(date, m.days) : null
		}));
}

/**
 * Timed flags in a `flags` block (country or planet): `flag = { flag_date flag_days }` —
 * `flag_date` is when it was set (hours: 2200.01.01 = 62808000, +24 a day), `flag_days` the days
 * left (2203.10.01: `superior_colonies_can_be_boosted`, set 2200.01.01 for 3600 days, 2250 left).
 * Plain flags (a number) never end.
 */
export function timedFlags(block: Raw, date: string): TimedModifier[] {
	return Object.entries((block ?? {}) as Record<string, Raw>)
		.filter(([, v]) => typeof v?.flag_days === 'number' && v.flag_days > 0)
		.map(([key, v]) => ({ key, until: addGameDays(date, v.flag_days) }));
}

const INSULT_COOLDOWN_DAYS = 30; // defines; the game's tooltip: insulted 2202.05.01 → 2202.06.01

/**
 * Dates the save holds for when something may be done again, if still ahead — all checked against
 * the game's tooltips 2026-10-25: a government reform (`country.government_date`, "we must wait
 * at least 18 years (2220.07.21)" in a game started 2200.01.01), dismissing a focus card
 * (`focus.next_dismiss_date`, 360 days), changing the focus priority
 * (`focus.priority.next_change_date`, 360 days), moving the capital (`country.capital_date`, "not
 * possible to move capital until 2212.07.01"), a species right (`last_changed_<right>` in the
 * species' rights block: despite its name the date it may change again, "2212.05.01" after a
 * change on 2202.05.01) and insulting an empire again (`country.ai.last_diplo_actions = { { country
 * action="action_insult" creation_date } }` + 30 days, per empire: another empire could be
 * insulted the same day).
 */
export function cooldowns(
	raw: Pick<RawSave, 'country' | 'date'> & Partial<Pick<RawSave, 'speciesDb' | 'countryBlocks'>>
) {
	const ahead = (v: Raw) => {
		const d = strOrNull(v);
		return d && d > raw.date && !d.startsWith('0.') ? d : null;
	};
	const focus = raw.country?.focus;
	const m = raw.country?.modules?.standard_species_rights_module;
	const rights = items(m?.primary).flatMap((p) =>
		Object.entries((p ?? {}) as Record<string, Raw>).flatMap(([k, v]) => {
			const until = k.startsWith('last_changed_') && k !== 'last_changed_value' ? ahead(v) : null;
			return until
				? [
						{
							species: speciesName(raw.speciesDb?.[String(p.species_index)]?.name),
							right: k
								.slice('last_changed_'.length)
								.replace(/_type$/, '')
								.replaceAll('_', ' '),
							until
						}
					]
				: [];
		})
	);
	const insults = items(raw.country?.ai?.last_diplo_actions).flatMap((a) => {
		const at = strOrNull(a?.creation_date);
		const until =
			a?.action === 'action_insult' && at ? ahead(addGameDays(at, INSULT_COOLDOWN_DAYS)) : null;
		return until
			? [
					{
						country: displayName(raw.countryBlocks?.[String(a.country)]?.name) || 'unknown empire',
						until
					}
				]
			: [];
	});
	return {
		reform: ahead(raw.country?.government_date),
		focusDismiss: ahead(focus?.next_dismiss_date),
		focusChange: ahead(focus?.priority?.next_change_date),
		capital: ahead(raw.country?.capital_date),
		rights,
		insults
	};
}

/**
 * A planet's deposits (`planet.deposits` → `deposit.<id> = { type swap_type }`; a blocker's
 * `swap_type` is the feature it hides — Earth: the Great Pacific Garbage Patch hides the Pacific
 * Algae Tracts) and its `timed_modifier` (features like `tidal_locked` are permanent ones).
 */
export function planetState(raw: Pick<RawSave, 'deposits' | 'date'>, planet: Raw): PlanetState {
	return {
		deposits: list(planet?.deposits)
			.map((d) => raw.deposits[String(d)])
			.filter((d) => typeof d?.type === 'string')
			.map((d) => ({ key: d.type, swap: typeof d.swap_type === 'string' ? d.swap_type : null })),
		modifiers: timedModifiers(planet?.timed_modifier, raw.date)
	};
}

/** `market.monthly_trades = { { trade_data = { trade_type=market_buy|market_sell resource country } amount } }` */
export function marketOrders(trades: Raw, countryId: number): MarketOrder[] {
	return (Array.isArray(trades) ? trades : [])
		.filter((t) => Number(t?.trade_data?.country) === countryId)
		.map((t) => ({
			kind: t.trade_data.trade_type === 'market_buy' ? ('buy' as const) : ('sell' as const),
			resource: String(t.trade_data.resource),
			amount: num(t.amount)
		}));
}

/**
 * The market the country trades on. Access to the galactic market is the country flag
 * `has_market_access` (set and removed together with `enable_galactic_market`, events
 * `on_action_events_2.txt` / `galactic_community_events.txt`). Its prices are
 * `market.fluctuations`, one per resource in the order of `common/strategic_resources`, traded
 * where `galactic_market_resources` is not 0 (confirmed on Yorphia, founded 2201.05.01: 26
 * entries, 4.5.2's order; all 0 through 2203.10.01 with no galactic trade made). The internal market's are
 * `market.internal_market_fluctuations = { country=<id> resources={ energy=-15.9 … } … }`, listing
 * only resources whose price has moved — the basic five always trade, at 0 when not listed.
 */
export function market(raw: Pick<RawSave, 'market' | 'country' | 'countryId'>): Market {
	if (raw.country?.flags?.has_market_access !== undefined) {
		const open = items(raw.market?.galactic_market_resources);
		const fluctuations = items(raw.market?.fluctuations);
		return {
			galactic: true,
			fluctuations: Object.fromEntries(
				MARKET_RESOURCES.flatMap((r, i) =>
					typeof fluctuations[i] === 'number' && num(open[i]) !== 0 ? [[r, fluctuations[i]]] : []
				)
			)
		};
	}
	const internal = raw.market?.internal_market_fluctuations;
	const at = items(internal?.country).findIndex((c) => Number(c) === raw.countryId);
	const own = at < 0 ? {} : items(internal.resources)[at];
	return {
		galactic: false,
		fluctuations: {
			...Object.fromEntries(ALWAYS_TRADED.map((r) => [r, 0])),
			...Object.fromEntries(
				Object.entries<Raw>(
					own && typeof own === 'object' && !Array.isArray(own) ? own : {}
				).filter(([, v]) => typeof v === 'number')
			)
		}
	};
}

const ALWAYS_TRADED = ['energy', 'minerals', 'food', 'consumer_goods', 'alloys'];

export const TRADING_TYPES = ['default', 'fallen_empire', 'awakened_fallen_empire'];

/**
 * Nomadic empires: those running the `situation_nomad_economy` (their operational reserves).
 * `is_nomadic` is the engine's, and the origin does not tell: 2212.06.01 had five of these
 * situations but one nomad origin.
 */
export function nomadCountries(situations: Record<string, Raw>): Set<number> {
	return new Set(
		Object.values(situations)
			.filter((s) => s?.type === 'situation_nomad_economy' && typeof s.country === 'number')
			.map((s) => Number(s.country))
	);
}

/**
 * A trader enclave's kind — 1 XuraCorp, 2 Riggans, 3 Muutagan — from the flag its system
 * initializer sets (`trader_enclave_country_<n>`, 4.5.2 leviathans_system_initializers.txt); null
 * for any other country.
 */
export function traderEnclaveKind(c: Raw): 1 | 2 | 3 | null {
	if (c?.type !== 'enclave') return null;
	const flags = c.flags ?? {};
	for (const k of [1, 2, 3] as const) if (`trader_enclave_country_${k}` in flags) return k;
	return null;
}

/**
 * Another empire's view of us — what the diplomacy screen shows: personality, attitude towards us
 * (`ai.attitude`, the entry for our country), their opinion of us and its modifiers (their
 * relation to us: `relation_current`, `modifier = { modifier value }`) — and what it hides: their
 * stockpile and monthly net (the budget's balance, the market's included).
 */
export function intelOf(
	id: number,
	c: Raw,
	toUs: Raw,
	us: number,
	nomadic = false,
	ourTechs: string[] | null = null,
	researchPartner = false
): AiIntel {
	const budget = c.budget?.current_month ?? {};
	const pactTrade = budget.income?.commercial_pacts?.trade;
	const theirTechs = items(c.tech_status?.technology).map(String);
	return {
		countryId: id,
		nomadic,
		personality: strOrNull(c.personality),
		attitude: strOrNull(items(c.ai?.attitude).find((a) => a?.country === us)?.attitude),
		opinion: numOrNull(toUs?.relation_current),
		trust: num(toUs?.trust),
		opinionModifiers: items(toUs?.modifier)
			.filter((m) => typeof m?.modifier === 'string')
			.map((m) => ({ key: String(m.modifier), value: num(m.value) })),
		stockpile: resources(c.modules?.standard_economy_module?.resources),
		net: addResources(sumSources(budget.balance), sumSources(budget.trade_balance)),
		income: addResources(sumSources(budget.income), sumSources(budget.trade_income)),
		...(storageMax(c.variables) && { max: storageMax(c.variables)! }),
		// what its commercial pacts bring it, so 10 % of the rest is what one with it brings us
		...(typeof pactTrade === 'number' && { commercialPactTrade: pactTrade }),
		// the techs only it has (READER 64, every empire we talk to: what a research agreement
		// would bring) and how many of ours it lacks; a research partner's list too (READER 45)
		...(ourTechs && {
			techsWeLack: theirTechs.filter((t) => !ourTechs.includes(t)),
			theyLackCount: ourTechs.filter((t) => !theirTechs.includes(t)).length,
			...(researchPartner && { techsTheyLack: ourTechs.filter((t) => !theirTechs.includes(t)) })
		})
	};
}

/** Companion mod 0.5.0's storage maximums (`sdash_m_<res>`) by resource; null: none exported. */
export function storageMax(variables: Raw): Resources | null {
	const max = Object.fromEntries(
		Object.entries(variables ?? {})
			.filter(([k, v]) => k.startsWith('sdash_m_') && typeof v === 'number' && v > 0)
			.map(([k, v]) => [k.slice('sdash_m_'.length), v as number])
	);
	return Object.keys(max).length ? max : null;
}

/** The budget's per-source flows for pops and planets: jobs (`planet_<job>`), strata (`pop_category_*`), … */
export const planetBudget = (month: Raw): BudgetSource[] =>
	budgetSources(month).filter((s) => /^(planet_|pop_)/.test(s.source));

/**
 * Every source of the month's budget with its income and expenses; the market's, booked apart
 * (`trade_income|trade_expenses`), as `market:<source>`.
 */
export function budgetSources(month: Raw): BudgetSource[] {
	const of = (income: Raw, expenses: Raw, prefix: string) =>
		[...new Set([...Object.keys(income ?? {}), ...Object.keys(expenses ?? {})])].map((source) => ({
			source: prefix + source,
			income: resources(income?.[source]),
			expenses: resources(expenses?.[source])
		}));
	return [
		...of(month?.income, month?.expenses, ''),
		...of(month?.trade_income, month?.trade_expenses, 'market:')
	];
}

/** The country's envoys; one is in use while it has a `location = { assignment=… }`. */
export function envoys(leaders: Raw[]) {
	const own = leaders.filter((l) => l?.class === 'envoy');
	return {
		used: own.filter((l) => l.location?.assignment !== undefined).length,
		total: own.length
	};
}

export const RESEARCH_AREAS = ['physics', 'society', 'engineering'];

/**
 * Every tech in the research queues with its progress (research points) and the date it was
 * started: the first per field is being researched, the others wait with what they have. A tech
 * switched away from keeps its progress elsewhere (`techKept`).
 */
/**
 * The progress of techs switched away from ("Change Research"): `tech_status.stored_techpoints_for_tech
 * = { <tech>=<points> … }`, all fields in one block. The game shows it on the tech's card and keeps
 * it after the card is redrawn away (throwaway UNE 4, 2200.01.20–03.02, 2026-11-06).
 */
export function techKept(country: Raw): Record<string, number> {
	const kept = country?.tech_status?.stored_techpoints_for_tech;
	if (!kept || typeof kept !== 'object') return {};
	return Object.fromEntries(
		Object.entries(kept)
			.map(([tech, points]): [string, number] => [tech, num(points)])
			.filter(([, points]) => points > 0)
	);
}

export function techQueued(country: Raw): QueuedTech[] {
	return RESEARCH_AREAS.flatMap((area) =>
		items(country?.tech_status?.[`${area}_queue`]).flatMap((q) =>
			q?.technology
				? [
						{
							area,
							tech: String(q.technology),
							progress: num(q.progress),
							since: typeof q.date === 'string' ? q.date : null
						}
					]
				: []
		)
	);
}

/**
 * country.tech_status.<area>_queue holds the tech being researched first; the council agenda
 * sits in country.government. `traditions` is a guess (none adopted in the saves seen so far).
 */
export function progress(raw: Pick<RawSave, 'country' | 'galaxy'>): Progress {
	const c = raw.country ?? {};
	const agenda = c.government?.council_agenda;
	return {
		research: RESEARCH_AREAS.flatMap((area) => {
			const current = first(c.tech_status?.[`${area}_queue`]);
			return current?.technology
				? [{ area, tech: String(current.technology), progress: num(current.progress) }]
				: [];
		}),
		researched: items(c.tech_status?.technology).filter((t) => typeof t === 'string'),
		agenda:
			typeof agenda === 'string' && agenda !== ''
				? { key: agenda, progress: num(c.government?.council_agenda_progress) }
				: null,
		traditionsTaken: Array.isArray(c.traditions) ? c.traditions.length : 0,
		nextElection: typeof c.next_election === 'string' ? c.next_election : null,
		costSettings: {
			technology: numOrNull(raw.galaxy?.technology) ?? 1,
			traditions: numOrNull(raw.galaxy?.traditions) ?? 1,
			difficulty: strOrNull(raw.galaxy?.difficulty),
			techDifficultyScale: strOrNull(raw.galaxy?.technology_difficulty_scale)
		}
	};
}

/** Our standing in the Shroud (see `Shroud`), or null before we can access it. */
export function shroud(
	raw: Pick<RawSave, 'country' | 'patronRelations' | 'countryId'>
): Shroud | null {
	const m = raw.country?.modules?.standard_shroud_module;
	if (!m || typeof m !== 'object') return null;
	const point = (v: Raw) => ({ x: num(v?.x), y: num(v?.y) });
	return {
		attunement: point(m.attunement),
		monthStart: point(m.month_start_attunement),
		lastDelve: strOrNull(m.last_delve_date),
		preferred: strOrNull(raw.country?.is_preferred_patron),
		patrons: Object.values(raw.patronRelations)
			.filter((p) => p && typeof p === 'object' && p.owner === raw.countryId)
			.map((p) => ({
				patron: String(p.patron ?? ''),
				...point(p.position),
				contact: String(p.contact ?? 'none'),
				calling:
					p.calling && typeof p.calling === 'object'
						? {
								key: String(p.calling.patron_objective ?? ''),
								tier: num(p.calling.tier),
								start: strOrNull(p.calling.calling_start_date),
								completed: p.calling.completed === true || p.calling.completed === 'yes'
							}
						: null,
				deeds: items(p.deeds)
					.map((d) => d?.patron_objective)
					.filter((d) => typeof d === 'string')
			}))
	};
}

/**
 * Our pops' ethics (see `EthicsState`); null where the save has none (a gestalt: no ethics). The
 * per-colony lists name colonies, kept as their place's id (`colonyPlaces`).
 */
export function ethics(country: Raw, places: Map<number, [number, Raw]>): EthicsState | null {
	if (!country || country.ethics_distribution === undefined) return null;
	return {
		pops: list(country.ethics_distribution),
		attraction: list(country.pops_ethics_attraction),
		change: list(country.pops_ethics_change),
		weight: list(country.ethics_attraction),
		colonies: items(country.pops_ethics_on_colonies)
			.filter((c) => c && typeof c === 'object')
			.map((c) => ({
				planetId: places.get(Number(c.colony))?.[0] ?? -1,
				pops: list(c.num_pops),
				change: list(c.change)
			}))
	};
}

/** Our factions (see `Faction`), by support. */
export function factions(raw: Pick<RawSave, 'popFactions' | 'countryId'>): Faction[] {
	return Object.values(raw.popFactions)
		.filter((f) => f && typeof f === 'object' && f.country === raw.countryId)
		.map((f) => ({
			type: String(f.type ?? ''),
			name: displayName(f.name),
			support: num(f.support_percent),
			approval: num(f.faction_approval),
			pops: numOrNull(f.last_month_pops),
			change: numOrNull(f.pops_change)
		}))
		.sort((a, b) => b.support - a.support);
}

/**
 * The systems we entered (`visited_objects`, and our own) whose star flags fire an entry event —
 * the save keeps the flags on `galactic_object.<id>.flags` from galaxy generation (Bir:
 * `guardians_hive_system`). null without entry events in the game data.
 */
export function systemEntries(
	raw: Pick<
		RawSave,
		'country' | 'countryId' | 'construction' | 'deposits' | 'shipDesigns' | 'starbases' | 'systems'
	>,
	events: EntryEvent[]
): SystemEntry[] | null {
	if (!events.length) return null;
	const entered = new Set([...list(raw.country?.visited_objects), ...ownSystems(raw)]);
	return [...entered]
		.sort((a, b) => a - b)
		.flatMap((id) => {
			const s = raw.systems[String(id)];
			if (!s || typeof s !== 'object') return [];
			const found = entryEventsFor(Object.keys(s.flags ?? {}), events);
			return found.length
				? [
						{
							systemId: id,
							system: displayName(s.name),
							events: found.map(({ id, title, onceFlag }) => ({
								id,
								title,
								...(onceFlag && { once: onceFlag })
							}))
						}
					]
				: [];
		});
}

/**
 * `country.government.council_agenda_cooldowns = { council_agenda start_date }`: `start_date` is
 * when the agenda can be picked again, not its launch — 2207.03.10, other empires: Infinite
 * Opportunities until 2231/2232, 30 years (COUNCIL_AGENDA_COOLDOWN) after their first agenda.
 */
export function agendaCooldowns(v: Raw): { key: string; until: string }[] {
	return items(v)
		.filter((c) => typeof c?.council_agenda === 'string' && typeof c?.start_date === 'string')
		.map((c) => ({ key: c.council_agenda, until: c.start_date }));
}
