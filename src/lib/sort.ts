import type { Snippet } from 'svelte';

// Sorting table rows by a column: numbers or text, unknown values (null) last either way, ties
// in their given order.

export type SortValue = number | string | null;

/** A column of `SortTable.svelte`: the value it sorts by and, optionally, how a cell shows it. */
export type Column<R> = {
	id: string;
	label: string;
	value: (r: R) => SortValue;
	cell?: Snippet<[R]>;
	title?: string;
	right?: boolean; // numbers: right-aligned
};

export function sortBy<T>(rows: T[], value: (r: T) => SortValue, desc: boolean): T[] {
	const dir = desc ? -1 : 1;
	return rows
		.map((r, i) => ({ r, i, v: value(r) }))
		.sort((a, b) => {
			if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
			const c =
				typeof a.v === 'string' || typeof b.v === 'string'
					? String(a.v).localeCompare(String(b.v))
					: a.v - b.v;
			return c * dir || a.i - b.i;
		})
		.map((x) => x.r);
}
