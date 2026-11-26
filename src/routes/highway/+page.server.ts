import { error } from '@sveltejs/kit';
import { techCostFactor } from '#lib/events.ts';
import {
	CONSTRUCTION,
	THEORY,
	closeFriends,
	highwayMarks,
	highwayView,
	isHighwayResolution,
	nextStep,
	type TechState
} from '#lib/highway.ts';
import { modName } from '#lib/modContent.ts';
import { nomadic } from '#lib/planner/kinds.ts';
import { mapView } from '#lib/situations.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';

// The Ancient Highway mod (#lib/highway.ts) at the branch's latest save that has it.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const shown = display(); // once per request
	const data = getGameData();
	const s = snaps.findLast((x) => x.kind === 'save' && x.highway);
	const h = s?.highway;
	if (!s || !h)
		return { ...rest, highway: null, spoiler: shown.highwayFriends, cheat: shown.highwayAll };

	const friends = closeFriends(s.countryId ?? -1, {
		diplomacy: s.diplomacy ?? [],
		wars: s.allWars ?? []
	});
	const view = highwayView(h, { friends, spoiler: shown.highwayFriends, cheat: shown.highwayAll });
	const g = campaignGalaxy(s.campaign);
	const systems = mapView(g?.systems ?? [], reveal(snaps), view.known);
	const names = new Map((g?.systems ?? []).map((x) => [x.id, x.name]));
	// base cost × the galaxy's slider × difficulty per tier; empire size left out (≈)
	const cost = (tech: string) => {
		const t = data.techs[tech];
		return t?.cost
			? Math.round(
					t.cost *
						(s.progress?.costSettings.technology ?? 1) *
						techCostFactor(t.tier ?? null, s.progress?.costSettings)
				)
			: null;
	};
	const tech = (key: string, state: TechState, granted: number) => ({
		key,
		name: modName(data, key, data.techs[key]?.name),
		state,
		cost: cost(key),
		granted
	});
	const ourPortals = view.portals.filter((p) => p.ours);
	// the mod's resolutions in the Galactic Community: in force, being voted on, proposed. Force a
	// Gate Open is one-shot (a `pass_date`, never in `passed`): its effect shows on the gate.
	const gc = s.galcom;
	const resolutions = gc
		? (
				[
					['in force', gc.passed],
					['voting', gc.voting ? [gc.voting] : []],
					['proposed', gc.proposed]
				] as const
			).flatMap(([state, votes]) =>
				votes
					.filter((v) => isHighwayResolution(v.type))
					.map((v) => ({
						id: v.id,
						name: modName(data, v.type),
						state,
						proposer: v.proposer,
						ours: v.ours
					}))
			)
		: [];
	// only an empire with a repaired gate it can use proposes them (the mod's
	// `ahw_can_use_own_gate`, 1.0.0); the repeal is open to every member
	const canPropose =
		!!gc?.member &&
		h.us.techs.theory === 'researched' &&
		ourPortals.some((p) => p.stage === 'repaired');
	return {
		...rest,
		date: s.date,
		highway: {
			nodes: h.nodes,
			awake: h.awake,
			portals: view.portals,
			express: view.express,
			us: {
				...h.us,
				techs: [
					tech(THEORY, h.us.techs.theory, h.us.granted.theory),
					tech(CONSTRUCTION, h.us.techs.construction, h.us.granted.construction)
				]
			},
			next: nextStep(ourPortals[0], h.us, nomadic(s)),
			fragments: h.us.fragments ?? [],
			galcom: gc ? { member: gc.member, canPropose, resolutions } : null,
			others: view.others.map((o) => ({
				...o,
				techs: [
					tech(THEORY, o.techs.theory, o.granted.theory),
					tech(CONSTRUCTION, o.techs.construction, o.granted.construction)
				]
			})),
			// our open highway studies (the mod's special projects), named from its texts
			studies: (s.specialProjects ?? [])
				.filter((p) => p.key.startsWith('AHW_'))
				.map((p) => ({
					...p,
					name: modName(data, p.key, data.projects[p.key]?.name),
					system: p.systemId === null ? null : (names.get(p.systemId) ?? null)
				}))
		},
		names: Object.fromEntries(names),
		map: highwayMarks(view, names),
		systems,
		territories: territoriesOf(snaps),
		spoiler: shown.highwayFriends,
		cheat: shown.highwayAll
	};
}
