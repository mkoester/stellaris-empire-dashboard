// Nomads contracts: which of the galaxy's contracts (`Snapshot.contracts`) the player sees.
//
// The save stores every contract but not who may see or accept one — the game's
// `potential_operator` / `possible_operator` triggers decide that, and scripts can only count the
// result (`count_visible_contracts`). So the rules here are ours (the user's call 2026-11-07):
// - nomad: what we operate, and the offers of issuers we have communications with — an issuer
//   needs communications with a nomad to issue at all (`can_issue_contracts_trigger`, 4.5.x
//   `scripted_triggers/09_scripted_triggers_nomads.txt`). Spoiler: offers of the others. Cheat:
//   everything, other operators' contracts too.
// - settled: the contracts we issued. Spoiler: others' contracts in systems up to the picked range
//   beyond our border. Cheat: everything. What the game itself shows a settled empire of other
//   empires' contracts is not known yet (docs/open-checks.md).
import { distances, type Graph } from './galaxyGraph.ts';
import type { Arkship, Contract, ContractProject, ContractType, Resources } from './types.ts';
import { valueOf } from './value.ts';

export type ContractWhy = 'mine' | 'offered' | 'spoiler' | 'cheat';
export type ContractKind = 'military' | 'science' | 'resource' | 'diplomacy' | 'other';

export type ContractRow = Contract & {
	name: string;
	category: string | null; // null: not in the data DB (a mod's contract, an older data DB)
	kind: ContractKind;
	internal: boolean; // the nomad's own (`*_internal`, Forever Cruise's crew and passengers)
	special: boolean; // `*_special` categories
	why: ContractWhy;
	jumps: number | null; // beyond our border, along known lanes; null: not reachable that way
};

export const CONTRACT_KINDS: ContractKind[] = [
	'military',
	'science',
	'resource',
	'diplomacy',
	'other'
];

/** Our own symbols and colours per kind (no game art). */
export const KIND_INFO: Record<ContractKind, { symbol: string; color: string }> = {
	military: { symbol: '⚔', color: '#c8463a' },
	science: { symbol: '⚗', color: '#2f8fe0' },
	resource: { symbol: '⚒', color: '#b07a2a' },
	diplomacy: { symbol: '⚖', color: '#1baf7a' },
	other: { symbol: '¤', color: '#c9822b' }
};

export const WHY_LABEL: Record<ContractWhy, string> = {
	mine: 'ours',
	offered: 'offered to us',
	spoiler: 'spoiler',
	cheat: 'cheat'
};

/** "military contract by Vel, taken by Korinth · spoiler" — a marker's or a hover's line. */
export function contractLine(r: ContractRow): string {
	const kind = r.kind === 'other' ? 'contract' : `${r.kind} contract`;
	const taken = r.operatorName && !r.internal ? `, taken by ${r.operatorName}` : '';
	const why = r.why === 'mine' || r.why === 'offered' ? '' : ` · ${WHY_LABEL[r.why]}`;
	return r.internal
		? `internal ${kind} of ${r.issuerName}${why}`
		: `${kind} by ${r.issuerName}${taken}${why}`;
}

export type ContractView = { range: string }; // RANGES: 'mine' | '0'…'10' | 'all'
export const DEFAULT_CONTRACT_VIEW: ContractView = { range: 'mine' };
export const CONTRACT_RANGES = ['mine', ...Array.from({ length: 11 }, (_, i) => String(i)), 'all'];

export function parseContractView(v: unknown): ContractView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ContractView>;
	return {
		range: CONTRACT_RANGES.includes(o.range as string)
			? (o.range as string)
			: DEFAULT_CONTRACT_VIEW.range
	};
}

/** military / science / resource / diplomacy from the category's name, else other. */
export function kindOf(category: string | null): ContractKind {
	const k = CONTRACT_KINDS.find((x) => x !== 'other' && category?.includes(x));
	return k ?? 'other';
}

/** Within the picked range beyond the border: `mine` is our own systems (0 jumps). */
export function inRange(jumps: number | null, range: string): boolean {
	if (range === 'all') return true;
	if (jumps === null) return false;
	return jumps <= (range === 'mine' ? 0 : Number(range));
}

/** Why the player may see a contract: always (mine, offered), behind the spoiler, or a cheat. */
export function whyOf(
	c: Contract,
	me: number,
	nomadic: boolean,
	talking: Set<number>,
	nearBorder: boolean
): ContractWhy {
	if (nomadic) {
		if (c.operator === me) return 'mine';
		if (c.state === 'offered') return talking.has(c.issuer) ? 'offered' : 'spoiler';
		return 'cheat';
	}
	if (c.issuer === me) return 'mine';
	return nearBorder ? 'spoiler' : 'cheat';
}

export type ContractContext = {
	me: number;
	nomadic: boolean;
	talking: Set<number>; // empires we have communications with
	jumps: Map<number, number>; // jumpsFromBorder()
	range: string;
	spoilers: boolean; // contractSpoilers
	all: boolean; // contractsAll
	types: Record<string, ContractType>;
};

const ORDER: Record<ContractWhy, number> = { mine: 0, offered: 1, spoiler: 2, cheat: 3 };

/** The contracts the switches let the player see, ours first, then by days left. */
export function contractRows(contracts: Contract[], ctx: ContractContext): ContractRow[] {
	return contracts
		.map((c): ContractRow => {
			const jumps = c.systemId === null ? null : (ctx.jumps.get(c.systemId) ?? null);
			const type = ctx.types[c.key];
			const category = type?.category ?? null;
			return {
				...c,
				name: type?.name ?? c.key,
				category,
				kind: kindOf(category),
				internal: category?.endsWith('_internal') ?? false,
				special: category?.endsWith('_special') ?? false,
				why: whyOf(c, ctx.me, ctx.nomadic, ctx.talking, inRange(jumps, ctx.range)),
				jumps
			};
		})
		.filter(
			(r) =>
				r.why === 'mine' ||
				r.why === 'offered' ||
				(r.why === 'spoiler' && (ctx.spoilers || ctx.all)) ||
				ctx.all
		)
		.sort(
			(a, b) =>
				ORDER[a.why] - ORDER[b.why] ||
				(a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
				a.id - b.id
		);
}

/** Map markers: one per system, its rows' kinds and the most visible reason. */
export function contractSystems(
	rows: ContractRow[]
): { systemId: number; rows: ContractRow[]; kinds: ContractKind[] }[] {
	const by = new Map<number, ContractRow[]>();
	for (const r of rows)
		if (r.systemId !== null) by.set(r.systemId, [...(by.get(r.systemId) ?? []), r]);
	return [...by].map(([systemId, rs]) => ({
		systemId,
		rows: rs,
		kinds: CONTRACT_KINDS.filter((k) => rs.some((r) => r.kind === k))
	}));
}

export type ContractMark = { systemId: number; kinds: ContractKind[]; title: string };

/** What the other maps draw: per system its contracts' kinds and one hover line each. */
export function contractMarks(
	rows: ContractRow[],
	systemNames: Record<number, string>
): ContractMark[] {
	return contractSystems(rows).map((s) => ({
		systemId: s.systemId,
		kinds: s.kinds,
		title: [
			systemNames[s.systemId] ?? `system ${s.systemId}`,
			...s.rows.map((r) => `${r.name}: ${contractLine(r)}`)
		].join('\n')
	}));
}

// ── Who is aboard which arkship ───────────────────────────────────────────────────────────────

/**
 * Contracts that put passengers on one of our arkships, marked by a fleet flag on its fleet (4.5.x
 * `events/nomads_events_1.txt`): Diplomatic Support's pickup (nomads.3036, on entering the pickup
 * system — at random among our arkships there), Prisoner Disposal (nomads.3050), the Sightseeing
 * Tour (nomads.3060). The game's own panels never say which arkship it is. The flag names no
 * contract, but a nomad can hold only one of each at a time (`possible_operator`:
 * `already_doing_same_contract`, `common/missions/missions/02_contracts.txt`), so the contract's
 * key is enough. Re-check on game updates.
 */
export const CONTRACT_CARGO: Record<string, { flag: string; who: string }> = {
	contract_diplomatic_support: { flag: 'carrying_delegates', who: 'the delegates' },
	contract_prisoner_disposal: { flag: 'transporting_prisoners', who: 'the prisoners' },
	contract_sightseeing_tour: { flag: 'sightseeing_tour_arkship', who: 'the tourists' }
};
export const CARGO_FLAGS = new Set(Object.values(CONTRACT_CARGO).map((c) => c.flag));

export type Aboard = { name: string; who: string; since: string | null };

/** The arkship that carries this contract's passengers: only for an active contract of ours. */
export function aboardOf(r: ContractRow, arkships: Arkship[]): Aboard | null {
	const cargo = CONTRACT_CARGO[r.key];
	if (!cargo || r.why !== 'mine' || r.state !== 'active') return null;
	for (const a of arkships) {
		const hit = a.cargo.find((c) => c.flag === cargo.flag);
		if (hit) return { name: a.name, who: cargo.who, since: hit.since };
	}
	return null;
}

// ── What a contract asks of us and pays (data DB `contract` + `special_project`) ──────────────

export type ArkshipKind = 'science' | 'military' | 'civilian';

/**
 * What the issuer's colony gets for 10 years from Colony Startup, by the type of arkship that did
 * the project (4.5.x `nomad_contract_colony_support_*`: their colonist jobs' extra output, from
 * `inline_scripts/output/colony_support_contract_*`; all three also +50 % building speed, −25 %
 * building cost, +10 % pop growth and assembly). Our reward is the same either way. Re-check on
 * game updates: the only project that branches on the arkship (`special_project.arkship_branches`).
 */
export const COLONY_SUPPORT: Record<ArkshipKind, string> = {
	science: '+1 physics, engineering and society research per colonist job',
	military: '+1 alloys per colonist job',
	civilian: '+1 consumer goods per colonist job and +100 amenities (a gestalt: the amenities only)'
};

/** The line for a project that branches on the arkship type, naming what ours would give. */
export function branchLine(arkships: ArkshipFit[]): string {
	const ours = arkships[0];
	return `The issuer's colony gets a bonus by the type of arkship that does it — your reward is the same.${
		ours ? ` ${ours.name} (${ours.kind}): ${COLONY_SUPPORT[ours.kind]}.` : ''
	}`;
}

/** An arkship's type from its size (`military_arkship_tier_1`, `military_arkship_champions_forge`). */
export function arkshipKind(size: string): ArkshipKind {
	return size.startsWith('science_')
		? 'science'
		: size.startsWith('military_')
			? 'military'
			: 'civilian';
}

const NEEDS: Record<string, string> = {
	carries_colony: 'an arkship',
	shipclass_science_ship: 'a science ship',
	shipclass_military: 'a military fleet',
	shipclass_constructor: 'a construction ship'
};

/** A project's requirements in words: {carries_colony: 1} → ["an arkship"]. */
export function needsOf(requirements: Record<string, unknown>): string[] {
	return Object.entries(requirements).map(([k, v]) =>
		k === 'leader' ? `a ${String(v)}` : (NEEDS[k] ?? `${k} ${JSON.stringify(v)}`)
	);
}

/**
 * The reward's scaling, the game's `contract_bonus_value`: +10 % per contract completed, 1 to
 * 50. Its other factor, `nomadic_contract_value_mult` (traditions, authority, leader traits), is
 * not read: the result is a lower bound, shown with ≈.
 */
export const contractBonus = (completed: number | null) =>
	Math.min(50, Math.max(1, 1 + (completed ?? 0) / 10));

export type RewardLine = { resource: string; amount: number; scaled: boolean };

export type ArkshipFit = {
	name: string;
	kind: ArkshipKind;
	capital: boolean;
	jumps: number | null; // along known lanes; null: no known route, or not placed
};

export type ContractDetail = {
	detailed: boolean; // false: the data DB predates the details
	description: string | null; // {issuer} and {system} filled in
	steps: number | null;
	projects: (ContractProject & { needs: string[] })[];
	reward: RewardLine[]; // the full success's, scaled ones × bonus
	partial: RewardLine[]; // a smaller reward for a partial success (military contracts), else []
	trade: number | null; // the reward's worth in trade
	bonus: number; // the scaling applied
	trust: number | null;
	opinion: number | null;
	failedOpinion: number | null;
	timeToComplete: number | null;
	missingTechs: string[];
	needsArkship: boolean; // a project needs one, or the contract has none (travel by arkship)
	arkshipBranches: boolean; // the outcome differs by arkship type
	arkships: ArkshipFit[]; // ours, nearest first
	aboard: Aboard | null; // the arkship carrying this contract's passengers
};

export type DetailContext = {
	completed: number | null; // Snapshot.contractsCompleted
	researched: Set<string>;
	arkships: Arkship[];
	lanes: Graph; // the known lanes, as the tab counts jumps
	values: Resources; // valuesOf(): one unit in trade
	systemName: string | null;
	techName: (key: string) => string;
};

const scaledLines = (
	s: { trade: number | null; resource: string | null; amount: number | null } | undefined,
	bonus: number
): RewardLine[] =>
	s
		? [
				...(s.trade ? [{ resource: 'trade', amount: s.trade * bonus, scaled: true }] : []),
				...(s.resource && s.amount
					? [{ resource: s.resource, amount: s.amount * bonus, scaled: true }]
					: [])
			]
		: [];

/** What a contract asks of us, what it pays, and how far each arkship of ours is from it. Pure. */
export function contractDetail(
	r: ContractRow,
	type: ContractType | undefined,
	ctx: DetailContext
): ContractDetail {
	const bonus = contractBonus(ctx.completed);
	const rw = type?.reward ?? null;
	const fixed = Object.entries(rw?.fixed ?? {}).map(([resource, amount]) => ({
		resource,
		amount,
		scaled: false
	}));
	const reward = [
		...scaledLines(rw?.scaled[0], bonus),
		...(rw?.cruise ? [{ resource: 'trade', amount: rw.cruise, scaled: true }] : []),
		...fixed
	];
	const partial = rw && rw.scaled.length > 1 ? [...scaledLines(rw.scaled[1], bonus), ...fixed] : [];
	const projects = (type?.projects ?? []).map((p) => ({ ...p, needs: needsOf(p.requirements) }));
	const needsArkship =
		!projects.length || projects.some((p) => p.requirements.carries_colony !== undefined);
	const from = (a: Arkship) =>
		a.systemId === null || r.systemId === null
			? null
			: (distances(ctx.lanes, [a.systemId]).jumps.get(r.systemId) ?? null);
	const arkships = ctx.arkships
		.map((a) => ({ name: a.name, kind: arkshipKind(a.size), capital: a.capital, jumps: from(a) }))
		.sort((a, b) => (a.jumps ?? Infinity) - (b.jumps ?? Infinity) || a.name.localeCompare(b.name));
	return {
		detailed: type?.detailed ?? false,
		description:
			type?.description
				?.replaceAll('{issuer}', r.issuerName)
				.replaceAll('{system}', ctx.systemName ?? 'the system') ?? null,
		steps: type?.steps ?? null,
		projects,
		reward,
		partial,
		trade: reward.length
			? reward.reduce((sum, l) => sum + valueOf({ [l.resource]: l.amount }, ctx.values), 0)
			: null,
		bonus,
		trust: rw?.trust ?? null,
		opinion: rw?.opinion ?? null,
		failedOpinion: type?.failedOpinion ?? null,
		timeToComplete: type?.timeToComplete ?? null,
		missingTechs: (type?.operatorTechs ?? [])
			.filter((t) => !ctx.researched.has(t))
			.map(ctx.techName),
		needsArkship,
		arkshipBranches: projects.some((p) => p.arkshipBranches),
		arkships,
		aboard: aboardOf(r, ctx.arkships)
	};
}
