import { describe, expect, it } from 'vitest';
import { countsFor, outlook } from './wanderlust.ts';
import type { Wanderlust } from './types.ts';

const cat = (key: string, seen: number, count: number, done = false) => ({
	key,
	seen,
	count,
	done
});
const sys = (wanderlust: string[], visited = true, owned = false) => ({
	wanderlust,
	visited,
	owned
});

describe('countsFor', () => {
	it("is the first flag in the game's order (nomads.4720's else_if chain)", () => {
		expect(countsFor(['space_ecology', 'enclave'])).toBe('enclave');
		expect(countsFor([])).toBeNull();
	});
});

describe('outlook', () => {
	const w = (categories: Wanderlust['categories'], complete = false): Wanderlust => ({
		categories,
		visits: [],
		complete
	});

	it('counts found targets, visited or owned, never the unvisited (a spoiler)', () => {
		const [o] = outlook(w([cat('enclave', 0, 2)]), [
			sys(['enclave']),
			sys(['enclave'], false, true),
			sys(['enclave'], false)
		]);
		expect(o).toMatchObject({ found: 2, open: 2, need: 2, finishable: true });
	});

	it('takes the counted ones off the found, and is not finishable short of the need', () => {
		const [o] = outlook(w([cat('marauder', 1, 4)]), [sys(['marauder']), sys(['marauder'])]);
		expect(o).toMatchObject({ found: 2, open: 1, need: 3, finishable: false });
	});

	it('a system flagged twice counts for its first category only', () => {
		const o = outlook(w([cat('enclave', 0, 1), cat('space_ecology', 0, 1)]), [
			sys(['enclave', 'space_ecology'])
		]);
		expect(o.map((x) => [x.key, x.found])).toEqual([
			['enclave', 1],
			['space_ecology', 0]
		]);
	});

	it('a done category, or the whole chain, needs nothing more', () => {
		expect(outlook(w([cat('precursor', 1, 1, true)]), [])[0]).toMatchObject({
			need: 0,
			finishable: false
		});
		expect(outlook(w([cat('precursor', 0, 1)], true), [])[0].need).toBe(0);
	});
});
