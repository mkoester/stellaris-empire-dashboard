import type { GameData } from '#lib/types.ts';
import type { AutoGoal } from './replay.ts';

// What a planned tech needs before it can be researched, as goals the plan implies (the user's ask
// 2026-10-31: Mega-Engineering → its prerequisites and "1 more Engineering tech of tier 3, 6 more
// of tier 4"): every prerequisite not yet researched, recursively (data DB
// `technology_requirement`; of an `OR` group the first alternative the empire can get, the others
// named), and every tier gate on the way — a tier opens once 6 techs of the
// tier below are researched in the same area (#lib/techTiers.ts). Ordered so that what comes
// first is listed first: gates by tier, prerequisites before the techs needing them. Pure.

const PREVIOUSLY_UNLOCKED = 6;

export function techNeeds(
	wanted: string[],
	researched: string[],
	techs: GameData['techs'],
	requirements: GameData['techRequirements'],
	// whether the empire can ever get a tech (`potential`): picks the alternative of an OR group
	possible: (potential: GameData['techRequirements'][string]['potential']) => boolean | null = () =>
		true
): AutoGoal[] {
	const done = new Set(researched);
	const count = (area: string, tier: number) =>
		researched.filter((k) => techs[k]?.area === area && techs[k]?.tier === tier).length;
	const out = new Map<string, AutoGoal & { for: Set<string>; or: Set<string> }>();
	const need = (g: AutoGoal, forName: string, or: string[] = []) => {
		const seen = out.get(g.id);
		if (seen) {
			seen.for.add(forName);
			or.forEach((x) => seen.or.add(x));
		} else out.set(g.id, { ...g, for: new Set([forName]), or: new Set(or) });
	};
	const name = (k: string) => techs[k]?.name ?? k;
	// an OR group: the first alternative this empire can get (by `potential`), the rest named
	const pick = (group: string[]) =>
		group.find((k) => possible(requirements[k]?.potential ?? null) !== false) ?? group[0];
	const visiting = new Set<string>();
	const visit = (tech: string, forName: string, root: boolean, or: string[] = []) => {
		if (done.has(tech) || visiting.has(tech)) return;
		visiting.add(tech);
		const t = techs[tech];
		// the tier gates up to this tech's tier, lowest first
		if (t?.tier != null)
			for (let tier = 2; tier <= t.tier; tier++)
				if (count(t.area, tier - 1) < PREVIOUSLY_UNLOCKED)
					need(
						{
							id: `auto-tier-${t.area}-${tier - 1}`,
							kind: 'tech_tier',
							target: { area: t.area, tier: tier - 1, count: PREVIOUSLY_UNLOCKED },
							polarity: 'want'
						},
						forName
					);
		for (const p of requirements[tech]?.prerequisites ?? []) visit(p, forName, false);
		for (const group of requirements[tech]?.anyOf ?? []) {
			if (group.some((k) => done.has(k))) continue;
			const chosen = pick(group);
			visit(
				chosen,
				forName,
				false,
				group.filter((k) => k !== chosen)
			);
		}
		if (!root)
			need(
				{ id: `auto-tech-${tech}`, kind: 'tech', target: { tech }, polarity: 'want' },
				forName,
				or
			);
		visiting.delete(tech);
	};
	for (const w of wanted) visit(w, techs[w]?.name ?? w, true);
	return [...out.values()].map(({ for: f, or, ...g }) => ({
		...g,
		note: `needed for ${[...f].join(', ')}${or.size ? ` — or instead ${[...or].map(name).join(' or ')}` : ''}`
	}));
}
