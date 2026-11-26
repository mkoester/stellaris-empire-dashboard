import { techCost } from '#lib/events.ts';
import {
	outcomeText,
	withProjects,
	withSpecimens,
	type Now,
	type OutcomeNode,
	type TechMark
} from '#lib/outcomes.ts';
import type { Display } from '#lib/profiles.ts';
import type { GameData, Snapshot } from '#lib/types.ts';

// What an anomaly, special project or dig site leads to, behind its spoiler switch: the tree with
// the projects it leads to filled in and its specimens' categories, and the same as tooltip text. Null when switched off or when
// the data DB has no tree (an older extractor).

type Spoilers = Pick<Display, 'anomalySpoilers' | 'projectSpoilers' | 'digSiteSpoilers'>;

type Trees = Pick<GameData, 'outcomeTrees'> & Partial<Pick<GameData, 'specimens'>>;

export function outcomeTrees(data: Trees, opts: Spoilers) {
	const t = data.outcomeTrees;
	const cats = Object.fromEntries(
		Object.entries(data.specimens ?? {}).flatMap(([k, s]) => (s.category ? [[k, s.category]] : []))
	);
	const full = (tree: OutcomeNode[] | undefined) =>
		tree?.length ? withSpecimens(withProjects(tree, t.project), cats) : null;
	return {
		anomaly: (category: string) => (opts.anomalySpoilers ? full(t.anomaly[category]) : null),
		project: (key: string) => (opts.projectSpoilers ? full(t.project[key]) : null),
		digSite: (type: string) => (opts.digSiteSpoilers ? full(t.dig_site[type]) : null)
	};
}

/**
 * What rewards come to for us now (`Now`), from a save: its gross income, per tech its cost at
 * the save's cost factors with what we research in its field a month (none once researched), and
 * its standing (`TechMark`) — `planned`: the plan's techs (`planSummary().plannedTechs`).
 */
export function outcomeNow(
	save: Pick<Snapshot, 'income' | 'progress' | 'empireSize' | 'techPermanent'> | null | undefined,
	data: Pick<GameData, 'techs' | 'defines'>,
	planned: ReadonlyMap<string, NonNullable<TechMark['plan']>> = new Map()
): Now {
	if (!save) return { income: null };
	const researched = new Set(save.progress?.researched ?? []);
	const permanent = new Set(save.techPermanent ?? []);
	return {
		income: save.income,
		mark: (key) => ({
			area: data.techs[key]?.area ?? null,
			researched: researched.has(key),
			permanent: permanent.has(key),
			plan: planned.get(key) ?? null
		}),
		tech: (key) => {
			const t = data.techs[key];
			const cost = t && !researched.has(key) ? techCost(key, save, data) : null;
			if (!t || cost === null) return null;
			const per = save.income?.[`${t.area}_research`];
			return { cost, area: t.area, perMonth: per && per > 0 ? per : null };
		}
	};
}

/**
 * The same as tooltip texts; `chapter`: a dig site's next chapter, marked. `now`: what months of
 * income and tech progress come to for us now (`outcomeNow()`).
 */
export function outcomeTips(data: Trees, opts: Spoilers, now: Now | null = null) {
	const trees = outcomeTrees(data, opts);
	const text = (tree: OutcomeNode[] | null, chapter: number | null = null) =>
		tree ? outcomeText(tree, chapter, now) : null;
	return {
		anomaly: (category: string) => text(trees.anomaly(category)),
		project: (key: string) => text(trees.project(key)),
		digSite: (type: string, chapter: number | null = null) => text(trees.digSite(type), chapter)
	};
}
