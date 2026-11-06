// A tech's tooltip as the game's research card has it — pure. Shared with the planner: its
// `src/lib/techCard.ts` is a copy of this file; keep the two in step.
//
// From the data DB (extraction): `technology` (area, tier, base cost), `technology_requirement`
// (prerequisites, OR groups, rare, dangerous), `technology_unlock` (what the card lists: the
// tech's own lines with their prefix, its features, and the buildings, districts, component sets,
// ship sizes and armies that need it). Techs it leads to are the techs naming it as a prerequisite.

export type TechUnlock = { kind: string; label: string | null; detail: string | null };

export type TechCardInput = {
	area: string;
	tier: number | null;
	cost: number | null;
	rare: boolean;
	dangerous: boolean;
	unlocks: TechUnlock[]; // in the card's order (`sort_order`)
	needs: string[]; // names: every one researched first
	needsAny: string[][]; // names: one of each group researched first
	leadsTo: string[]; // names
};

// The card's prefix per derived kind; a `line` carries its own.
const PREFIX: Record<string, string> = {
	building: 'Unlocks Building',
	district: 'Unlocks District',
	component: 'Unlocks Component',
	ship: 'Unlocks Ship Type',
	army: 'Unlocks Army',
	feature: 'Unlocks Feature'
};

/** "Unlocks Building: Field Dynamics Center" — one line per unlock, as the card shows it. */
export const unlockLine = (u: TechUnlock): string | null =>
	u.label === null ? null : PREFIX[u.kind] ? `${PREFIX[u.kind]}: ${u.label}` : u.label;

/** The card's short facts and its unlock lines. */
export function techCard(t: TechCardInput): { facts: string[]; unlocks: string[] } {
	const needs = [
		...t.needs,
		...t.needsAny.map((g) => (g.length > 1 ? `${g.slice(0, -1).join(', ')} or ${g.at(-1)}` : g[0]))
	];
	return {
		facts: [
			`${t.area}, tier ${t.tier ?? '?'}`,
			...(t.cost ? [`base cost ${t.cost.toLocaleString('en')}`] : []),
			...(t.rare ? ['rare'] : []),
			...(t.dangerous ? ['dangerous'] : []),
			...(needs.length ? [`needs ${needs.join(', ')}`] : []),
			...(t.leadsTo.length ? [`leads to ${t.leadsTo.join(', ')}`] : [])
		],
		unlocks: t.unlocks.map(unlockLine).filter((l): l is string => l !== null)
	};
}
