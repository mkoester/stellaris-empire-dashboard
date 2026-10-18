import type { GameData } from './types.ts';

// Adopted tradition trees with their picks, in adoption order (`country.traditions` lists every
// adopted tradition, the tree's adopt and finish entries included).

export type TreeRow = {
	key: string;
	name: string;
	picked: { key: string; name: string }[];
	total: number; // traditions to pick in the tree (adopt and finish not counted)
	finished: boolean;
	all: { key: string; name: string; role: string; active: boolean }[]; // the tree in game order
};

export function adoptedTrees(owned: string[], data: Pick<GameData, 'traditionTrees'>): TreeRow[] {
	const have = new Set(owned);
	return Object.entries(data.traditionTrees)
		.map(([key, tree]) => {
			const adopt = tree.traditions.find((t) => t.role === 'adopt');
			const normal = tree.traditions.filter((t) => t.role === 'normal');
			return {
				key,
				name: tree.name,
				adopted: adopt !== undefined && have.has(adopt.key),
				order: adopt ? owned.indexOf(adopt.key) : -1,
				picked: owned.flatMap((k) => normal.filter((t) => t.key === k)),
				total: normal.length,
				finished: tree.traditions.some((t) => t.role === 'finish' && have.has(t.key)),
				all: tree.traditions.map((t) => ({ ...t, active: have.has(t.key) }))
			};
		})
		.filter((t) => t.adopted)
		.sort((a, b) => a.order - b.order)
		.map(({ key, name, picked, total, finished, all }) => ({
			key,
			name,
			picked: picked.map((t) => ({ key: t.key, name: t.name })),
			total,
			finished,
			all
		}));
}
