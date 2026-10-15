import { branch } from '#lib/server/branch.ts';
import {
	popSeries,
	researchSeries,
	resourceSeries,
	scalarSeries,
	withoutResearch,
	xRange
} from '#lib/series.ts';

export function load({ url }) {
	const b = branch(url);
	if (b === null) return { empty: true as const };
	const { snaps, ...rest } = b;
	return {
		empty: false as const,
		...rest,
		xRange: xRange(snaps),
		charts: {
			pops: popSeries(snaps),
			empireSize: scalarSeries(snaps, 'empire size', (s) => s.empireSize),
			research: researchSeries(snaps),
			stockpile: resourceSeries(snaps, (s) => withoutResearch(s.stockpile)),
			balance: resourceSeries(snaps, (s) => withoutResearch(s.balance)),
			income: resourceSeries(snaps, (s) => withoutResearch(s.income))
		}
	};
}
