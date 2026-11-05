// The research speed actually applied, measured: the progress a tech in progress gained between two
// monthly saves ÷ the research output booked in the earlier one. Planetforgers 2213–2214: 1.48 in
// every area and month; Roaming Korinth 1.19 then 1.24; UNE 1.07; Yorphia 0.94. Stored research is
// drawn on top, unboosted (2214.02: 2.48 = 1.48 + 1 while stored points remained), so a month with
// stored points is not measured. Every research speed modifier sits in this factor — how they add
// up the game files do not say (engine).

import { toDays } from './events.ts';
import type { Snapshot } from './types.ts';

export type SpeedReading = { factor: number; date: string; tech: string };

/** The latest measured factor per area (physics, society, engineering); absent: none yet. */
export function researchSpeed(history: Snapshot[]): Record<string, SpeedReading> {
	const saves = history.filter(
		(s) => s.kind === 'save' && s.progress !== null && s.date.endsWith('.01')
	);
	const out: Record<string, SpeedReading> = {};
	for (let i = 1; i < saves.length; i++) {
		const [a, b] = [saves[i - 1], saves[i]];
		if (toDays(b.date) - toDays(a.date) !== 30) continue; // consecutive month starts only
		for (const r of b.progress!.research) {
			const before = a.progress!.research.find((x) => x.area === r.area && x.tech === r.tech);
			const output = a.income?.[`${r.area}_research`] ?? 0;
			const stored = a.techStored?.[r.area];
			if (!before || output <= 0 || stored === undefined || stored > 0) continue;
			out[r.area] = { factor: (r.progress - before.progress) / output, date: b.date, tech: r.tech };
		}
	}
	return out;
}

/**
 * The share of a tech's time a +`bonus` speed saves on top of `factor`, if the game adds speed
 * bonuses up (the usual Paradox rule for modifiers of one kind): 1 − factor ÷ (factor + bonus).
 * At factor 1 that is 20 % for +25 %, at 1.48 only 14.5 %.
 */
export const savedShare = (bonus: number, factor = 1) => bonus / (factor + bonus);
