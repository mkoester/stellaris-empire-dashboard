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
import type { Contract, ContractType } from './types.ts';

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
