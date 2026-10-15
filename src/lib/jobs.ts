import type { ColonyJob } from './types.ts';

// Jobs summed over colonies, ordered like the game groups them: rulers, specialists, workers,
// then civilians and anything else; within a stratum by pops worked.

export type JobInfo = Record<string, { name: string; category: string | null }>;
export type JobRow = ColonyJob & { name: string; category: string };

const STRATA = ['ruler', 'specialist', 'worker', 'civilian'];

export function jobRows(jobs: ColonyJob[], info: JobInfo): JobRow[] {
	const byType = new Map<string, ColonyJob>();
	for (const j of jobs) {
		const sum = byType.get(j.type);
		byType.set(
			j.type,
			sum
				? {
						type: j.type,
						pops: sum.pops + j.pops,
						filled: sum.filled + j.filled,
						positions:
							sum.positions === null || j.positions === null ? null : sum.positions + j.positions
					}
				: { ...j }
		);
	}
	const rank = (c: string) => (STRATA.includes(c) ? STRATA.indexOf(c) : STRATA.length);
	return [...byType.values()]
		.map((j) => ({
			...j,
			name: info[j.type]?.name ?? j.type,
			category: info[j.type]?.category ?? ''
		}))
		.sort((a, b) => rank(a.category) - rank(b.category) || b.pops - a.pops);
}
