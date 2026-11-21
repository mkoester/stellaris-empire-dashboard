import { modifierTintKey } from './modifiers.ts';
import type { ArchiveHolding, Exhibit, GameData, Modifier, Resources, Specimen } from './types.ts';

// The Grand Archive — pure. From the game files (4.5.4, docs/tabs-empire.md "Archive tab"):
// - three exhibitions of 9 exhibits each, 60 storage slots (defines GRAND_ARCHIVE_EXHIBITIONS_COUNT,
//   GRAND_ARCHIVE_EXHIBITS_COUNT, COLLECTION_STORAGE_SLOTS_COUNT);
// - a specimen's modifiers and resources apply while its exhibit is active, each block ×
//   value:<category>_specimens_modifiers_mult = 1 + modifier:<category>_specimens_produces_mult +
//   modifier:specimens_produces_mult (common/script_values/05_script_values_grand_archive.txt);
// - its worth in a trade, in energy: the sell value by rarity × TRADE_VALUE_SPECIMEN_MULT 1.3,
//   × 1.25 when it completes the receiver's category, × 1.5 when that category is empty
//   (TRADE_VALUE_SPECIMEN_COMPLETE_CATEGORY_MULT / _EMPTY_CATEGORY_MULT);
// - an AI trades specimens only at MIN_RELATION_TO_TRADE_SPECIMENS 750 (read as its opinion of
//   us: docs/open-points.md), and an empire that traded one is flagged
//   has_already_traded_specimens for SPECIMEN_TRADE_FLAG_DAYS 3600.

export const CATEGORIES = [
	{ key: 'aesthetic_wonder', name: 'Aesthetic Wonders' },
	{ key: 'historical_item', name: 'Galactic History' },
	{ key: 'xeno_geology', name: 'Xeno Geology' }
] as const;

export const EXHIBITS_PER_CATEGORY = 9;
export const STORAGE_SLOTS = 60;
export const RARITIES = ['common', 'rare', 'epic', 'exceptional'] as const;
/** Rarity colours as the game's Collection view tints a specimen's name. */
export const RARITY_TONE: Record<string, string> = {
	common: 'text-gray-600',
	rare: 'text-sky-700',
	epic: 'text-purple-700',
	exceptional: 'text-amber-600'
};
export const SELL_VALUE: Record<string, number> = {
	common: 250,
	rare: 500,
	epic: 1000,
	exceptional: 2000
};
export const TRADE_MULT = 1.3;
export const COMPLETE_MULT = 1.25;
export const EMPTY_MULT = 1.5;
export const MIN_OPINION = 750;
/** The tech the Grand Archive needs (common/megastructures/20_grand_archive.txt). */
export const ARCHIVE_TECH = 'tech_galactic_archivism';

/** What a condition (a specimen block's `potential`) asks of an empire; null: not known. */
export type EmpireFacts = {
	gestalt: boolean | null;
	lithoid: boolean | null;
	infernal: boolean | null;
	consumerGoods: boolean | null; // country_uses_consumer_goods
	flags: string[] | null;
};

const FACT: Record<string, keyof Omit<EmpireFacts, 'flags'>> = {
	is_gestalt: 'gestalt',
	is_lithoid: 'lithoid',
	is_infernal: 'infernal',
	country_uses_consumer_goods: 'consumerGoods'
};

/** One `key = value` of a condition: true, false, or null when the facts cannot tell. */
function leaf(part: string, f: EmpireFacts): boolean | null {
	const m = /^(\w+)\s*=\s*(\w+)$/.exec(part.trim());
	if (!m) return null; // a nested operator the extractor kept as a marker (NOT, …)
	const [, key, value] = m;
	if (key === 'has_country_flag') return f.flags === null ? null : f.flags.includes(value);
	const fact = FACT[key] ? f[FACT[key]] : null;
	if (fact === null || fact === undefined || (value !== 'yes' && value !== 'no')) return null;
	return fact === (value === 'yes');
}

/**
 * Whether a condition holds: parts joined by ", " all hold, "(a OR b)" one of them; null when a
 * part that could decide it is unknown. No condition: always.
 */
export function holds(condition: string | null, f: EmpireFacts): boolean | null {
	if (!condition) return true;
	let unknown = false;
	for (const part of condition.split(/,\s*(?![^(]*\))/)) {
		const p = part.trim();
		const ors = p.startsWith('(') ? p.slice(1, -1).split(/\s+OR\s+/) : null;
		const r = ors
			? ors.some((o) => leaf(o, f) === true)
				? true
				: ors.some((o) => leaf(o, f) === null)
					? null
					: false
			: leaf(p, f);
		if (r === false) return false;
		if (r === null) unknown = true;
	}
	return unknown ? null : true;
}

/** Our empire's facts from a snapshot's fields. */
export function factsOf(
	s: {
		government: string[] | null; // civics, ethics and authority keys
		founderClass: string | null;
		species: { cls: string; traits: string[] }[] | null;
		expenses: Resources | null;
		countryFlags: string[] | null;
	},
	data: Pick<GameData, 'speciesArchetypes'>
): EmpireFacts {
	const founder = s.founderClass;
	return {
		gestalt: s.government ? s.government.includes('ethic_gestalt_consciousness') : null,
		lithoid: founder ? data.speciesArchetypes[founder] === 'LITHOID' : null,
		infernal: founder
			? (s.species ?? []).some((sp) => sp.cls === founder && sp.traits.includes('trait_infernal'))
			: null,
		consumerGoods: s.expenses ? (s.expenses.consumer_goods ?? 0) > 0 : null,
		flags: s.countryFlags
	};
}

/** Another empire's facts: only what its ethics tell (gestalt). */
export const factsOfOther = (c: { ethics: string[] } | undefined): EmpireFacts => ({
	gestalt: c ? c.ethics.includes('ethic_gestalt_consciousness') : null,
	lithoid: null,
	infernal: null,
	consumerGoods: null,
	flags: null
});

export type BonusLine = Modifier & {
	condition: string | null;
	applies: boolean | null; // the condition holds (true), not (false), or cannot be told (null)
	from: string; // the specimen's name
};

/**
 * What one specimen gives while exhibited in its category: its modifiers and resources × `mult`. A
 * modifier whose condition fails for the empire is left out; one that cannot be told stays, marked.
 */
export function specimenGives(
	spec: Specimen,
	facts: EmpireFacts,
	mult = 1
): { bonuses: BonusLine[]; produces: Resources } {
	const bonuses: BonusLine[] = [];
	for (const m of spec.modifiers) {
		const applies = holds(m.condition, facts);
		if (applies === false) continue;
		bonuses.push({ ...m, value: m.value * mult, applies, from: spec.name });
	}
	const produces: Resources = Object.fromEntries(
		Object.entries(spec.produces).map(([r, v]) => [r, v * mult])
	);
	return { bonuses, produces };
}

export type CategoryView = {
	key: string;
	name: string;
	// each with what it gives once active (`gives`), active or not
	exhibits: (Exhibit & {
		spec: Specimen | null;
		gives: { bonuses: BonusLine[]; produces: Resources } | null;
	})[];
	mult: number;
	bonuses: BonusLine[]; // per active exhibit's modifier, × mult; those whose condition fails left out
	produces: Resources; // a month, × mult
};

/**
 * The three exhibitions with what each gives: every active exhibit's modifiers and resources ×
 * the category's multiplier (`mults`, 1 where unknown), as `specimenGives()`.
 */
export function exhibitions(
	holding: ArchiveHolding | null,
	data: Pick<GameData, 'specimens'>,
	facts: EmpireFacts,
	mults: Record<string, number> = {}
): CategoryView[] {
	return CATEGORIES.map(({ key, name }) => {
		const mult = mults[key] ?? 1;
		const exhibits = (holding?.exhibits ?? [])
			.filter((e) => e.category === key)
			.map((e) => {
				const spec = data.specimens[e.specimen] ?? null;
				return { ...e, spec, gives: spec ? specimenGives(spec, facts, mult) : null };
			});
		const bonuses: BonusLine[] = [];
		const produces: Resources = {};
		for (const e of exhibits) {
			if (!e.active || !e.gives) continue;
			bonuses.push(...e.gives.bonuses);
			for (const [r, v] of Object.entries(e.gives.produces)) produces[r] = (produces[r] ?? 0) + v;
		}
		return { key, name, exhibits, mult, bonuses, produces };
	});
}

// The bonus filter's kinds beyond the label colours (#lib/modifiers.ts `modifierTintKey`)
const KIND_TOPICS: [RegExp, string][] = [
	[/research|researchers/, 'research'],
	[/^(ship|army|starbase|command_limit)_/, 'military'],
	[/space_fauna|vivarium/, 'space fauna'],
	[/pop_|logistic_growth/, 'pops']
];

/** A modifier's kind for the bonus filter: its colour key (a resource, amenities, …), else a topic. */
export const bonusKind = (key: string): string =>
	modifierTintKey(key) ?? KIND_TOPICS.find(([re]) => re.test(key))?.[1] ?? 'other';

/** Every kind of bonus a specimen gives: its modifiers' and its resources'. */
export const givesKinds = (g: { bonuses: { key: string }[]; produces: Resources }): string[] => [
	...new Set([...g.bonuses.map((b) => bonusKind(b.key)), ...Object.keys(g.produces)])
];

/** Every kind of bonus any specimen gives: the bonus filter's full list. */
export const allKinds = (data: Pick<GameData, 'specimens'>): string[] => [
	...new Set(
		Object.values(data.specimens).flatMap((s) =>
			givesKinds({ bonuses: s.modifiers, produces: s.produces })
		)
	)
];

/** Lines of the same modifier (and condition) summed, the specimens they come from kept. */
export function sumBonuses(lines: BonusLine[]): (BonusLine & { sources: string[] })[] {
	const out = new Map<string, BonusLine & { sources: string[] }>();
	for (const l of lines) {
		const id = `${l.key}|${l.condition ?? ''}`;
		const t = out.get(id) ?? { ...l, value: 0, sources: [] };
		t.value += l.value;
		t.sources.push(l.from);
		out.set(id, t);
	}
	return [...out.values()];
}

/** How many specimens a holding has in an exhibition, and in all. */
export const countIn = (h: ArchiveHolding | null, category: string) =>
	(h?.exhibits ?? []).filter((e) => e.category === category).length;

export const hasSpecimen = (h: ArchiveHolding | null, specimen: string) =>
	[...(h?.exhibits ?? []), ...(h?.storage ?? [])].some((e) => e.specimen === specimen);

/**
 * A specimen's worth in a trade to the empire receiving it, in energy: sell value × 1.3, × 1.5 if
 * the receiver's exhibition of its category is empty, × 1.25 if it would fill it. Without a
 * receiver, the plain × 1.3.
 */
export function tradeEnergy(spec: Specimen, receiver: ArchiveHolding | null | undefined): number {
	const base = (SELL_VALUE[spec.rarity] ?? 0) * TRADE_MULT;
	if (receiver === undefined) return base;
	const n = countIn(receiver, spec.category);
	if (n === 0) return base * EMPTY_MULT;
	if (n === EXHIBITS_PER_CATEGORY - 1) return base * COMPLETE_MULT;
	return base;
}

/**
 * Why a specimen cannot change hands now — the trade screen refuses the deal whatever is offered;
 * empty: it can. Not tradable, the receiver has it ("not of interest"), its archive full, or either
 * side flagged for a specimen trade in the last 10 years.
 */
export function blockers(
	spec: Specimen,
	key: string,
	giver: ArchiveHolding | null,
	receiver: ArchiveHolding | null,
	ctx: { date: string; receiverIsUs: boolean }
): string[] {
	const out: string[] = [];
	const until = (h: ArchiveHolding | null) =>
		h?.tradeUntil && h.tradeUntil > ctx.date ? h.tradeUntil : null;
	if (!spec.tradable) out.push('this specimen cannot be traded');
	if (hasSpecimen(receiver, key))
		out.push(ctx.receiverIsUs ? 'we have it already' : 'they have it already');
	const g = until(giver);
	const r = until(receiver);
	if (g) out.push(`${ctx.receiverIsUs ? 'they' : 'we'} traded specimens recently: not before ${g}`);
	if (r) out.push(`${ctx.receiverIsUs ? 'we' : 'they'} traded specimens recently: not before ${r}`);
	const room = STORAGE_SLOTS + EXHIBITS_PER_CATEGORY * CATEGORIES.length;
	if (receiver && receiver.exhibits.length + receiver.storage.length >= room)
		out.push(`${ctx.receiverIsUs ? 'our' : 'their'} archive is full`);
	return out;
}

/**
 * Why the AI would refuse a specimen deal however good (≈, docs/open-points.md): an attitude or
 * personality that trades nothing, or an opinion of us under MIN_RELATION_TO_TRADE_SPECIMENS
 * (750, read as opinion). Empty: it trades at the price.
 */
export function refusals(ctx: { opinion: number | null; trades: boolean }): string[] {
	const out: string[] = [];
	if (!ctx.trades) out.push('their attitude or personality trades nothing');
	if (ctx.opinion !== null && ctx.opinion < MIN_OPINION)
		out.push(`their opinion of us (${ctx.opinion}) is under ${MIN_OPINION}`);
	return out;
}

/**
 * Energy each side of a specimen deal comes to, from the trade model (#lib/aiTrade.ts: acceptance
 * = what we offer × its willingness − what it offers, both in the same energy points, so its
 * energy income cancels): `price` what we would pay in energy for one of theirs (its plain worth
 * ÷ willingness — whether the giver's own category counts is not known), `bid` what it would pay
 * for one of ours (its worth to it, with its category's empty or complete bonus, × willingness).
 * Estimates (≈): calibrate against the trade screen (docs/open-points.md).
 */
export function specimenDeal(
	spec: Specimen,
	them: ArchiveHolding | null,
	willingness: number | null
): { price: number | null; bid: number } {
	const w = willingness ?? 1;
	return {
		price: w > 0 ? tradeEnergy(spec, undefined) / w : null,
		bid: tradeEnergy(spec, them) * w
	};
}
