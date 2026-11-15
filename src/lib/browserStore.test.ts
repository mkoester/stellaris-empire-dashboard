import { describe, expect, it } from 'vitest';
import { keep, keepList, recall, recallList } from './browserStore.ts';

const memory = () => {
	const kept = new Map<string, string>();
	return () => ({
		getItem: (k: string) => kept.get(k) ?? null,
		setItem: (k: string, v: string) => void kept.set(k, v)
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

	it('goes without when storage is blocked', () => {
		expect(recall('a', blocked)).toBeNull();
		expect(() => keep('a', '1', blocked)).not.toThrow();
		expect(recallList('a', blocked)).toEqual([]);
	});
});
