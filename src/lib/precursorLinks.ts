// Which precursors an anomaly, special project or dig site leads to: the frontier tab's Precursor
// badge (a spoiler, `precursorBadges`). Pure.

// the words the files use for each (keys, event chains, flags, event text), in the game's order
const NAMES: [RegExp, string][] = [
	[/vultaum/i, 'Vultaum'],
	[/yuht/i, 'Yuht'],
	[/first[ _]league|\bleague_\d+_cat\b/i, 'First League'],
	[/irassian/i, 'Irassians'],
	[/cybrex/i, 'Cybrex'],
	[/\bbaol|grunur/i, 'Baol'],
	[/zroni/i, 'Zroni'],
	[/inetian/i, 'Inetian Traders'],
	[/adakkaria/i, 'adAkkaria']
];

/** The precursors named in a key or anywhere in its outcome tree (the unresolved one from the data
 * DB: 4.5.4, 62 anomaly categories, 88 special projects, 20 dig sites). */
export function precursorsOf(key: string, tree: unknown): string[] {
	const text: string[] = [key];
	const walk = (n: unknown) => {
		if (typeof n === 'string') text.push(n);
		else if (Array.isArray(n)) n.forEach(walk);
		else if (n && typeof n === 'object') Object.values(n).forEach(walk);
	};
	walk(tree);
	const all = text.join(' ');
	return NAMES.filter(([re]) => re.test(all)).map(([, name]) => name);
}
