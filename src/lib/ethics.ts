import type { EthicAxis } from './types.ts';

// How close two empires' ethics are, for the diplomacy tab. Pure.
//
// Each ethic sits on one of four axes (4.5.2 `common/ethics/99_documentation.txt`): −2 fanatic,
// −1 regular on the first pole, +1 / +2 on the second (`EthicAxis`); an axis an empire holds no
// ethic on is 0. Gestalt consciousness is an axis of its own (`hive`).

export const AXES = ['col', 'xen', 'mil', 'spi'] as const;
export type Axis = (typeof AXES)[number];

/** Short names per axis: first pole, second pole. Ours. */
const SHORT: Record<string, [string, string]> = {
	col: ['Au', 'Eg'],
	xen: ['Xo', 'Xi'],
	mil: ['Mi', 'Pa'],
	spi: ['Sp', 'Ma']
};

/** An empire's ethics as places on the axes. */
export type Profile = { gestalt: boolean; pos: Record<Axis, number> };

export function profile(ethics: string[], axes: Record<string, EthicAxis>): Profile {
	const pos = { col: 0, xen: 0, mil: 0, spi: 0 };
	let gestalt = false;
	for (const e of ethics) {
		const a = axes[e];
		if (!a) continue;
		if (a.axis === 'hive') gestalt = true;
		else if (a.axis in pos) pos[a.axis as Axis] = a.pos;
	}
	return { gestalt, pos };
}

/**
 * Steps apart over the four axes, 0–16 (authoritarian vs. fanatic egalitarian: 3). Null between
 * a gestalt and a non-gestalt empire: there is no common scale.
 */
export function ethicDistance(a: Profile, b: Profile): number | null {
	if (a.gestalt !== b.gestalt) return null;
	return AXES.reduce((s, x) => s + Math.abs(a.pos[x] - b.pos[x]), 0);
}

/** The axes the two hold opposite poles of. */
export function opposingAxes(a: Profile, b: Profile): Axis[] {
	return AXES.filter((x) => a.pos[x] * b.pos[x] < 0);
}

/**
 * What the members' ethics cost a federation's cohesion, by the defines (4.5.2): each unique
 * ethic beyond `FEDERATION_BASE_ETHICS` (3) `FEDERATION_ETHICS_PENALTY` (−0.15), each axis held at
 * both poles `FEDERATION_OPPOSING_ETHICS_PENALTY` (−0.5). How the engine counts is not in the
 * files: here a fanatic ethic counts as its regular one, and an opposition once per axis — ≈.
 */
export function federationPenalty(
	members: string[][],
	axes: Record<string, EthicAxis>,
	defines: Record<string, number>
): number {
	const held = new Set(
		members.flat().flatMap((e) => {
			const a = axes[e];
			return a ? [a.axis === 'hive' ? 'hive' : `${a.axis}${Math.sign(a.pos)}`] : [];
		})
	);
	const opposing = AXES.filter((x) => held.has(`${x}-1`) && held.has(`${x}1`)).length;
	const extra = Math.max(0, held.size - (defines.FEDERATION_BASE_ETHICS ?? 3));
	// `|| 0`: no −0 to print
	return (
		extra * (defines.FEDERATION_ETHICS_PENALTY ?? -0.15) +
			opposing * (defines.FEDERATION_OPPOSING_ETHICS_PENALTY ?? -0.5) || 0
	);
}

/** An ethic's short name — upper case when fanatic ("MI") — and its colour key in `colors.ts`. */
export function ethicMark(
	ethic: string,
	axes: Record<string, EthicAxis>
): { short: string; fanatic: boolean; color: string } | null {
	const a = axes[ethic];
	if (!a) return null;
	if (a.axis === 'hive') return { short: 'Ge', fanatic: false, color: 'ethic-hive' };
	const pole = a.pos < 0 ? 0 : 1;
	const s = SHORT[a.axis]?.[pole];
	if (!s) return null;
	const fanatic = Math.abs(a.pos) === 2;
	return { short: fanatic ? s.toUpperCase() : s, fanatic, color: `ethic-${a.axis}-${pole}` };
}

/** Ethics in axis order (as the game lists them), so the same ethics always read alike. */
export function sortEthics(ethics: string[], axes: Record<string, EthicAxis>): string[] {
	const rank = (e: string) => {
		const i = (AXES as readonly string[]).indexOf(axes[e]?.axis ?? '');
		return i < 0 ? AXES.length : i;
	};
	return [...ethics].sort((a, b) => rank(a) - rank(b));
}
