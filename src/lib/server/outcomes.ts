import { techCost } from '#lib/events.ts';
import { outcomeText, withProjects, type Now, type OutcomeNode } from '#lib/outcomes.ts';
import type { Display } from '#lib/profiles.ts';
import type { GameData, Snapshot } from '#lib/types.ts';

// What an anomaly, special project or dig site leads to, behind its spoiler switch: the tree with
// the projects it leads to filled in, and the same as tooltip text. Null when switched off or when
// the data DB has no tree (an older extractor).

type Spoilers = Pick<Display, 'anomalySpoilers' | 'projectSpoilers' | 'digSiteSpoilers'>;

export function outcomeTrees(data: Pick<GameData, 'outcomeTrees'>, opts: Spoilers) {
	const t = data.outcomeTrees;
	const full = (tree: OutcomeNode[] | undefined) =>
		tree?.length ? withProjects(tree, t.project) : null;
	return {
		anomaly: (category: string) => (opts.anomalySpoilers ? full(t.anomaly[category]) : null),
		project: (key: string) => (opts.projectSpoilers ? full(t.project[key]) : null),
		digSite: (type: string) => (opts.digSiteSpoilers ? full(t.dig_site[type]) : null)
	};
}

/**
 * What rewards come to for us now (`Now`), from a save: its gross income, and per tech its cost at
 * the save's cost factors with what we research in its field a month (none once researched).
 */
export function outcomeNow(
	save: Pick<Snapshot, 'income' | 'progress' | 'empireSize'> | null | undefined,
	data: Pick<GameData, 'techs' | 'defines'>
): Now {
	if (!save) return { income: null };
	const researched = new Set(save.progress?.researched ?? []);
	return {
		income: save.income,
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
export function outcomeTips(
	data: Pick<GameData, 'outcomeTrees'>,
	opts: Spoilers,
	now: Now | null = null
) {
	const trees = outcomeTrees(data, opts);
	const text = (tree: OutcomeNode[] | null, chapter: number | null = null) =>
		tree ? outcomeText(tree, chapter, now) : null;
	return {
		anomaly: (category: string) => text(trees.anomaly(category)),
		project: (key: string) => text(trees.project(key)),
		digSite: (type: string, chapter: number | null = null) => text(trees.digSite(type), chapter)
	};
}
