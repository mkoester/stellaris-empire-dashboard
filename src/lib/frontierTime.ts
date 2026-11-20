// How long an open anomaly, special project or dig site takes, before speed bonuses. Pure.
// - anomaly: SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS for the scientist's level against the anomaly's
//   (`anomalyDays()`, #lib/ships.ts);
// - special project: a ship's or fleet's its `days_to_research`; a research one its `cost` at the
//   department's monthly research — it halts that field meanwhile (concepts_l_english.yml,
//   concept_special_project_desc);
// - dig site: at the end of each phase (ARCHAEOLOGICAL_SITE_DISCOVERY_DAYS = 90, 4.5 defines) a
//   d10 plus skill plus clues minus the chapter's difficulty: 14 or more finishes the chapter,
//   11–13 adds 2 clues, 6–10 adds 1 (scripted_effects/archaeology_event_effects.txt,
//   standard_archaeological_site_on_roll_failed_case). Assumed, not checked in game: the skill
//   bonus is the scientist's level, a phase is 90 days, a new chapter starts without clues.

export const PHASE_DAYS = 90;

/** A duration for the tab: its days, whether estimated (≈), and how it was found. */
export type Time = { days: number; approx: boolean; note: string };
const FINISH = 14;
const gain = (score: number) => (score >= 11 ? 2 : score >= 6 ? 1 : 0);

/** The expected number of rolls to finish a chapter from `clues`, with `base` = skill −
 * difficulty. Clues only grow, so each state needs only the ones above it. */
export function expectedRolls(base: number, clues = 0): number {
	const memo = new Map<number, number>();
	const at = (c: number): number => {
		if (base + c + 1 >= FINISH) return 1; // every roll finishes
		const hit = memo.get(c);
		if (hit !== undefined) return hit;
		let stay = 0;
		let rest = 1;
		for (let d = 1; d <= 10; d++) {
			const s = base + c + d;
			if (s >= FINISH) continue;
			const g = gain(s);
			if (g === 0) stay += 0.1;
			else rest += 0.1 * at(c + g);
		}
		const e = rest / (1 - stay);
		memo.set(c, e);
		return e;
	};
	return at(clues);
}

/** Days to finish a dig site's remaining chapters: the next one from its clues and the days to its
 * next roll, the later ones from scratch. `difficulties`: the remaining chapters', next first. */
export function digDays(
	level: number,
	difficulties: number[],
	clues: number,
	daysLeft: number | null
): number | null {
	if (!difficulties.length) return null;
	const [first, ...later] = difficulties;
	const firstDays =
		(expectedRolls(level - first, clues) - 1) * PHASE_DAYS + (daysLeft ?? PHASE_DAYS);
	return later.reduce((sum, d) => sum + expectedRolls(level - d) * PHASE_DAYS, firstDays);
}

/** A research project's days: its cost at the department's monthly research; null unknown. */
export function researchDays(
	cost: number,
	department: string | null,
	income: Record<string, number> | null
) {
	const field = department?.replace(/_technology$/, '_research');
	const per = field ? income?.[field] : undefined;
	return per && per > 0 ? (cost / per) * 30 : null;
}

/** "120 d", "1.5 y". */
export const daysText = (d: number) =>
	d >= 360 ? `${(d / 360).toFixed(1)} y` : `${Math.round(d)} d`;
