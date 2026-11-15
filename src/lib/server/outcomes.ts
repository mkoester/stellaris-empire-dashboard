import { outcomeText, withProjects, type OutcomeNode } from '#lib/outcomes.ts';
import type { Display } from '#lib/profiles.ts';
import type { GameData } from '#lib/types.ts';

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

/** The same as tooltip texts; `chapter`: a dig site's next chapter, marked. */
export function outcomeTips(data: Pick<GameData, 'outcomeTrees'>, opts: Spoilers) {
	const trees = outcomeTrees(data, opts);
	const text = (tree: OutcomeNode[] | null, chapter: number | null = null) =>
		tree ? outcomeText(tree, chapter) : null;
	return {
		anomaly: (category: string) => text(trees.anomaly(category)),
		project: (key: string) => text(trees.project(key)),
		digSite: (type: string, chapter: number | null = null) => text(trees.digSite(type), chapter)
	};
}
