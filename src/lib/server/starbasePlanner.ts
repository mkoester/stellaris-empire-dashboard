import { facts } from '#lib/government.ts';
import { discovered, jumpsFromBorder } from '#lib/situations.ts';
import { planStarbases, type PartPlan, type PlannerSystem } from '#lib/starbasePlanner.ts';
import type { Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { display } from './settings.ts';

const SHOWN = 8; // systems per part sent to the page

/**
 * The starbase planner's input from the latest save and the campaign's galaxy as the viewer may
 * see it: our systems and the discovered, unclaimed ones up to `range` jumps beyond the border
 * ('mine' | '1'…'10' | 'all'), each with our starbase, our colonies and its orbital deposits'
 * base output per station kind (data DB `deposit` category and `produces`). Then the plan
 * (#lib/starbasePlanner.ts), each part's best systems.
 */
export function starbasePlan(
	save: Snapshot,
	range: string
): { plans: PartPlan[]; systemNames: Record<number, string>; candidates: number } | null {
	const game = getGameData();
	if (!Object.keys(game.starbaseParts).length) return null; // data DB before 2026-11-09
	const g = campaignGalaxy(save.campaign);
	if (!g) return null;
	const shown = display();
	const galaxy = discovered(g.systems, { whole: shown.wholeGalaxy, stars: false });
	const beyond = jumpsFromBorder(galaxy);
	const max = range === 'mine' ? 0 : range === 'all' ? Infinity : Number(range);

	const stations = new Map(
		(save.stations ?? [])
			.filter((s) => !s.arkship && s.systemId != null)
			.map((s) => [s.systemId!, s])
	);
	const colonies = new Map(save.colonies.map((c) => [c.planetId, c]));
	const systems: PlannerSystem[] = galaxy.flatMap((s) => {
		const jumps = s.owned ? 0 : beyond.get(s.id);
		if (jumps === undefined || jumps > max) return [];
		if (!s.owned && s.ownerId !== null) return []; // someone else's
		const bodies = (s.bodies ?? []).filter((b) => !b.star);
		const deposits: PlannerSystem['deposits'] = { gatherers: {}, researchers: {} };
		let total = 0;
		let worked = 0;
		for (const b of bodies) {
			if (b.colonized) continue; // a colony's deposits are its own, not a station's
			for (const d of b.deposits) {
				const kind =
					game.depositCategory[d] === 'orbital_mining_deposits'
						? 'gatherers'
						: game.depositCategory[d] === 'orbital_research_deposits'
							? 'researchers'
							: null;
				const out = game.costs.deposit[d]?.produces;
				if (!kind || !out) continue;
				total += 1;
				if (b.station) worked += 1;
				for (const [r, v] of Object.entries(out)) deposits[kind][r] = (deposits[kind][r] ?? 0) + v;
			}
		}
		const st = stations.get(s.id);
		return [
			{
				id: s.id,
				name: s.name,
				jumps,
				station:
					s.owned && st ? { level: st.level, modules: st.modules, buildings: st.buildings } : null,
				colonies: bodies.flatMap((b) => {
					const c = colonies.get(b.id);
					return c && !c.colonizing
						? [
								{
									name: c.name,
									pops: c.pops,
									civilians: c.civilians,
									growth: (c.growth?.by.growth ?? 0) + (c.growth?.by.assembly ?? 0),
									stability: c.stability
								}
							]
						: [];
				}),
				deposits,
				deposited: { total, worked }
			}
		];
	});
	const f = facts(save, game.scriptedTriggers, { shipKinds: game.shipKinds });
	const plans = planStarbases(game.starbaseParts, systems, f, game.starbaseSlots).map((p) => ({
		...p,
		best: p.best.slice(0, SHOWN)
	}));
	return {
		plans,
		systemNames: Object.fromEntries(systems.map((s) => [s.id, s.name])),
		candidates: systems.length
	};
}
