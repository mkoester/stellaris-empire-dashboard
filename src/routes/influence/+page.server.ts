import { error } from '@sveltejs/kit';
import { sourceLabel } from '#lib/flows.ts';
import {
	INFLUENCE_LABELS,
	influenceSeries,
	lostAtCap,
	powerProjection,
	uncollected
} from '#lib/influence.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { unbooked, xExtent } from '#lib/series.ts';
import { namedSpending } from '#lib/spending.ts';

const label = (source: string) => INFLUENCE_LABELS[source] ?? sourceLabel(source);

// Influence (#lib/influence.ts): the month by budget source, the sources over time, what the
// budget does not explain (claims, outposts, decisions, …), and what goes uncollected.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.budget !== null) ?? null;
	const data = getGameData();
	const spends = namedSpending(snaps, {
		names: data.names,
		edicts: data.edicts,
		shipCosts: Object.fromEntries(Object.entries(data.costs.ship).map(([k, c]) => [k, c.cost]))
	});
	const rivals = (latest?.relations ?? []).filter((r) => r.agreements.includes('is_rival')).length;
	const pp =
		latest && latest.empireSize !== null && latest.navalUsed !== null
			? powerProjection(
					latest.empireSize,
					latest.navalUsed,
					latest.budget?.find((s) => s.source === 'country_power_projection')?.income.influence ?? 0
				)
			: null;
	const u = unbooked(snaps, 'influence', spends);
	return {
		...rest,
		budget: latest?.budget ?? null,
		budgetDate: latest?.date ?? null,
		labels: Object.fromEntries(
			[...new Set(snaps.flatMap((s) => (s.budget ?? []).map((x) => x.source)))].map((s) => [
				s,
				label(s)
			])
		),
		series: influenceSeries(snaps, label),
		unbooked: u,
		lostAtCap: latest ? lostAtCap(latest, u) : null,
		uncollected: latest ? uncollected(latest, rivals, u) : [],
		powerProjection: pp,
		navalUsed: latest?.navalUsed ?? null,
		empireSize: latest?.empireSize ?? null,
		rivals,
		stockpile: latest?.stockpile.influence ?? null,
		max: latest?.storageMax?.influence ?? null,
		xExtent: xExtent(snaps)
	};
}
