// The research speed actually applied, measured: the progress a tech in progress gained between two
// month-start saves ÷ the research output booked in the earlier one — or, in an area researching
// nothing, the stored points' growth ÷ that output (UNE 2, 2201.02–06: +14.32 a month on 14.04 =
// ×1.02, the Head of Research at level 1). Planetforgers 2213–2214: 1.48 in every area and month;
// Roaming Korinth 1.19 then 1.24; Yorphia 0.94 — each 1 + the sum of its speed bonuses
// (#lib/researchBonuses.ts). Stored research is drawn on top of a tech's progress, unboosted
// (2214.02: 2.48 = 1.48 + 1 while points were stored), so such a month is not measured.

import { toDays } from './events.ts';
import type { Snapshot } from './types.ts';

export type SpeedReading = { factor: number; date: string; tech: string | null }; // null: stored points

/** The latest measured factor per area (physics, society, engineering); absent: none yet. */
export function researchSpeed(history: Snapshot[]): Record<string, SpeedReading> {
	const saves = history.filter(
		(s) => s.kind === 'save' && s.progress !== null && s.date.endsWith('.01')
	);
	const out: Record<string, SpeedReading> = {};
	for (let i = 1; i < saves.length; i++) {
		const [a, b] = [saves[i - 1], saves[i]];
		if (toDays(b.date) - toDays(a.date) !== 30) continue; // consecutive month starts only
		// an area researching nothing in either save: its stored points grow at the speed
		for (const area of ['physics', 'society', 'engineering']) {
			const idle = (x: Snapshot) => !x.progress!.research.some((r) => r.area === area);
			const output = a.income?.[`${area}_research`] ?? 0;
			if (!idle(a) || !idle(b) || output <= 0 || !a.techStored || !b.techStored) continue;
			const grown = (b.techStored[area] ?? 0) - (a.techStored[area] ?? 0);
			if (grown > 0) out[area] = { factor: grown / output, date: b.date, tech: null };
		}
		for (const r of b.progress!.research) {
			const before = a.progress!.research.find((x) => x.area === r.area && x.tech === r.tech);
			const output = a.income?.[`${r.area}_research`] ?? 0;
			// an area without stored points is absent from the save's list; null: not read (old reader)
			if (!before || output <= 0 || a.techStored === null || (a.techStored[r.area] ?? 0) > 0)
				continue;
			out[r.area] = { factor: (r.progress - before.progress) / output, date: b.date, tech: r.tech };
		}
	}
	return out;
}

/**
 * The share of a tech's time a +`bonus` speed saves on top of `factor`, as the game adds speed
 * bonuses up (seen in game, 2026-11-05): 1 − factor ÷ (factor + bonus).
 * At factor 1 that is 20 % for +25 %, at 1.48 only 14.5 %.
 */
export const savedShare = (bonus: number, factor = 1) => bonus / (factor + bonus);
