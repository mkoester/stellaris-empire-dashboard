import {
	feeMult,
	isCapital,
	localAlternatives,
	logisticsFee,
	perWorker,
	shortfall,
	type LocalAlternative
} from '#lib/colonyLogistics.ts';
import { jobOutput } from '#lib/luxuries.ts';
import { rankFor } from '#lib/produce.ts';
import type { Colony, Resources } from '#lib/types.ts';
import { getGameData } from './app.ts';
import type { branch } from './branch.ts';
import { produceData } from './produce.ts';
import { produceView } from './settings.ts';
import { valuesOf } from './unitCosts.ts';

type Branch = NonNullable<ReturnType<typeof branch>>;

/**
 * What the fee rule needs at the branch tip: the rates (data DB), the galaxy's multiplier and the
 * country's `country_base` income, which covers the capital's shortfall first.
 */
export function feeInputs(b: Branch) {
	const rates: Resources = {};
	for (const [k, v] of Object.entries(getGameData().resourceInfo))
		if (typeof v.deficitTrade === 'number') rates[k] = v.deficitTrade;
	return {
		rates,
		mult: feeMult(b.snaps.findLast((s) => s.galaxySetup)?.galaxySetup),
		base:
			b.snaps.findLast((s) => s.budget)?.budget?.find((x) => x.source === 'country_base')?.income ??
			{}
	};
}

/** A colony's shortfall and its fee under `feeInputs()`. */
export function colonyFee(c: Colony, f: ReturnType<typeof feeInputs>) {
	const short = shortfall(c, isCapital(c) ? f.base : {});
	return { short, fee: logisticsFee(short, f.rates, f.mult) };
}

export type ColonyLogistics = {
	fee: number;
	mult: number;
	capital: Resources | null; // the country_base income that covered the capital's shortfall first
	worker: number; // trade a month an employed pop's job output is worth here
	months: number; // the produce tab's horizon the local options are priced over
	unpriced: string[];
	rows: (LocalAlternative & { feeTrade: number })[];
};

/**
 * What a colony's deficits cost a month and, per resource, whether making it here would be
 * cheaper: the produce tab's options on this colony (districts with room, a cleared blocker's
 * district) and the building types we have built (free building slots are not in the save),
 * ranked over the produce tab's horizon at the empire's values.
 */
export function colonyLogistics(b: Branch, colony: Colony): ColonyLogistics | null {
	const f = feeInputs(b);
	const { short, fee } = colonyFee(colony, f);
	if (!Object.keys(short).length) return null;
	const produce = produceData(b);
	const view = produceView();
	const values = { ...valuesOf(b.snaps), ...view.weights };
	const here = (produce?.options ?? []).filter(
		(o) => o.colony === colony.planetId || o.kind === 'building'
	);
	const worker = perWorker(jobOutput(b.jobs[colony.planetId] ?? []), colony.employed, values);
	const rows = Object.fromEntries(
		Object.keys(short).map((r) => [
			r,
			rankFor(r, here, values, view.months, produce?.market?.buy[r] ?? null)
		])
	);
	return {
		fee: fee.total,
		mult: f.mult,
		capital: isCapital(colony) ? f.base : null,
		months: view.months,
		unpriced: fee.unpriced,
		worker,
		rows: localAlternatives(short, values, rows, f.rates, f.mult, worker, colony.civilians).map(
			(a) => ({
				...a,
				feeTrade: fee.byResource[a.resource] ?? 0
			})
		)
	};
}
