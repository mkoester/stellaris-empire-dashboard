import { describe, expect, it } from 'vitest';
import { forget, keep, keepList, recall, recallList } from './browserStore.ts';

const memory = () => {
	const kept = new Map<string, string>();
	return () => ({
		getItem: (k: string) => kept.get(k) ?? null,
		setItem: (k: string, v: string) => void kept.set(k, v),
		key: (i: number) => [...kept.keys()][i] ?? null,
		get length() {
			return kept.size;
		},
		removeItem: (k: string) => void kept.delete(k)
	});
};
const blocked = () => {
	throw new Error('SecurityError');
};

describe('browserStore', () => {
	it('recalls what it kept', () => {
		const store = memory();
		expect(recall('a', store)).toBeNull();
		keep('a', '1', store);
		expect(recall('a', store)).toBe('1');
	});

	it('keeps lists of strings, and reads anything else as none', () => {
		const store = memory();
		expect(recallList('l', store)).toEqual([]);
		keepList('l', ['x', 'y'], store);
		expect(recallList('l', store)).toEqual(['x', 'y']);
		keep('l', '{"not":"a list"}', store);
		expect(recallList('l', store)).toEqual([]);
		keep('l', '["x", 3, null]', store);
		expect(recallList('l', store)).toEqual(['x']);
		keep('l', 'not json', store);
		expect(recallList('l', store)).toEqual([]);
	});

	it('forgets the keys a test picks', () => {
		const store = memory();
		keep('galaxy-map-height', '600', store);
		keep('galaxy-map-height-square', '700', store);
		keep('galaxy-map-width', 'wide', store);
		expect(forget((k) => k.includes('-map-height'), store)).toBe(2);
		expect(recall('galaxy-map-height', store)).toBeNull();
		expect(recall('galaxy-map-width', store)).toBe('wide');
		expect(forget(() => true, blocked)).toBe(0);
	});

	it('goes without when storage is blocked', () => {
		expect(recall('a', blocked)).toBeNull();
		expect(() => keep('a', '1', blocked)).not.toThrow();
		expect(recallList('a', blocked)).toEqual([]);
	});
});
