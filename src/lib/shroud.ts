import type { GameData, PatronRelation, Shroud } from './types.ts';

// The Shroud panel: what the game's Shroud screen shows of each contacted patron. Pure.

export type DeedRow = { key: string; name: string; weight: number };
export type PatronCard = {
	key: string;
	name: string;
	color: string | null;
	standing: number; // the game's "65 / 1000"
	calling: {
		name: string;
		tier: number;
		reward: number | null;
		start: string | null;
		completed: boolean;
	} | null;
	positive: DeedRow[]; // its deeds: towards it
	negative: DeedRow[]; // the opposite patron's deeds: away from it
	accords: { kind: string; name: string }[];
	covenant: string | null;
	preferred: boolean;
};

/** A patron's standing: the month-start attunement towards it × 1000 (the game's screen). */
export const standing = (monthStart: { x: number; y: number }, p: { x: number; y: number }) =>
	Math.round(1000 * (monthStart.x * p.x + monthStart.y * p.y));

/** The patron across the circle: its deeds count against this one. */
export const opposite = (all: PatronRelation[], p: PatronRelation) =>
	all.find((o) => o !== p && o.x === -p.x && o.y === -p.y && (p.x !== 0 || p.y !== 0)) ?? null;

const deedRows = (keys: string[], data: GameData['shroud'], sign: 1 | -1): DeedRow[] =>
	keys
		.map((k) => ({
			key: k,
			name: data.deeds[k]?.name ?? k,
			weight: sign * (data.deeds[k]?.attunement ?? 0)
		}))
		.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

/** The contacted patrons, as the game lists them — the others stay hidden. */
export function patronCards(s: Shroud, data: GameData['shroud']): PatronCard[] {
	return s.patrons
		.filter((p) => p.contact === 'completed')
		.map((p) => {
			const info = data.patrons[p.patron];
			const calling = p.calling && data.callings[p.calling.key];
			return {
				key: p.patron,
				name: info?.name ?? p.patron,
				color: info?.color ?? null,
				standing: standing(s.monthStart, p),
				calling: p.calling
					? {
							name: calling?.name ?? p.calling.key,
							tier: p.calling.tier,
							reward: calling?.tiers[p.calling.tier] ?? null,
							start: p.calling.start,
							completed: p.calling.completed
						}
					: null,
				positive: deedRows(p.deeds, data, 1),
				negative: deedRows(opposite(s.patrons, p)?.deeds ?? [], data, -1),
				accords: info?.accords ?? [],
				covenant: info?.covenant ?? null,
				preferred: s.preferred === p.patron
			};
		});
}
