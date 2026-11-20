// What leads towards the L-Gates (Distant Stars): the frontier tab's badge. Pure.

// L-Gate Insights (`distar.9000`), the L-Gate Activation tech, "The path to the L-Cluster may now be
// opened.", the L-Cluster project, the `encountered_first_lgate` flag
const LGATE = /\bL-(Gate|Cluster)|lgate|lcluster/i;

/** Whether a name or anything in an outcome tree — event titles, tech options, notes, conditions —
 * names the L-Gates or the L-Cluster. 4.5.4: 24 anomaly categories (L-Gate Insights, 3 in 10 on
 * most) and 9 special projects. The tree is behind its spoiler: without it, only the name tells. */
export function lgateRelated(name: string, tree: unknown): boolean {
	if (LGATE.test(name)) return true;
	const walk = (n: unknown): boolean =>
		typeof n === 'string'
			? LGATE.test(n)
			: Array.isArray(n)
				? n.some(walk)
				: !!n && typeof n === 'object' && Object.values(n).some(walk);
	return walk(tree);
}
