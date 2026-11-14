import { describe, expect, it } from 'vitest';
import { dataStore, type DataSource } from './dataStore.ts';

/** A fake extractor: mod sets are strings, files `<set>.sqlite`; `fail` makes a run fall back. */
function fake(fail = new Set<string>()) {
	const runs: string[] = [];
	const onDisk = new Set<string>();
	const loads: string[] = [];
	let active = 0;
	let maxActive = 0;
	const src: DataSource<string, string> = {
		fileFor: (m) => `${m}.sqlite`,
		exists: (f) => onDisk.has(f),
		ensure: async (m) => {
			runs.push(m);
			maxActive = Math.max(maxActive, ++active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
			const file = fail.has(m) ? 'vanilla.sqlite' : `${m}.sqlite`;
			onDisk.add(file);
			return file;
		},
		load: (f) => {
			loads.push(f);
			return `data of ${f}`;
		}
	};
	return { src, runs, loads, onDisk, maxActive: () => maxActive };
}

describe('dataStore', () => {
	it('extracts and loads a mod set once, however many ask at once', async () => {
		const f = fake();
		const s = dataStore(f.src);
		expect(s.get('a')).toBeUndefined();
		const [x, y] = await Promise.all([s.ensure('a'), s.ensure('a')]);
		expect(x).toBe(y);
		expect(x).toEqual({ file: 'a.sqlite', data: 'data of a.sqlite' });
		await s.ensure('a');
		expect(f.runs).toEqual(['a']);
		expect(f.loads).toEqual(['a.sqlite']);
		expect(s.get('a')).toBe(x);
	});

	it('loads a data DB already on disk at once, without extracting', () => {
		const f = fake();
		f.onDisk.add('a.sqlite');
		const s = dataStore(f.src);
		expect(s.get('a')).toEqual({ file: 'a.sqlite', data: 'data of a.sqlite' });
		expect(s.get('b')).toBeUndefined();
		expect(f.runs).toEqual([]);
	});

	it('runs one extraction at a time and says what is pending', async () => {
		const f = fake();
		const s = dataStore(f.src);
		const both = Promise.all([s.ensure('a'), s.ensure('b')]);
		expect(s.pending('b')).toBe(true);
		await both;
		expect(f.maxActive()).toBe(1);
		expect(s.pending('b')).toBe(false);
	});

	it('keeps the most recently used few, and names the latest', async () => {
		const f = fake();
		const s = dataStore(f.src, { keep: 2 });
		await s.ensure('a');
		await s.ensure('b');
		s.get('a'); // a is now the most recent
		await s.ensure('c'); // drops b
		f.onDisk.delete('b.sqlite');
		expect(s.get('b')).toBeUndefined();
		expect(s.latest()?.file).toBe('c.sqlite');
		expect(s.get('a')?.file).toBe('a.sqlite');
		expect(s.latest()?.file).toBe('a.sqlite');
	});

	it('a failed modded run serves the game data under its own key, loaded once', async () => {
		const f = fake(new Set(['broken']));
		const s = dataStore(f.src);
		await s.ensure('vanilla');
		const l = await s.ensure('broken');
		expect(l.file).toBe('vanilla.sqlite');
		expect(f.loads).toEqual(['vanilla.sqlite']);
		expect(s.get('broken')).toBe(l);
	});

	it('a failed run rejects for its callers but not for the next', async () => {
		const f = fake();
		f.src.ensure = async (m) => {
			if (m === 'bad') throw new Error('no python');
			return `${m}.sqlite`;
		};
		const s = dataStore(f.src, { onError: () => {} });
		await expect(s.ensure('bad')).rejects.toThrow('no python');
		expect(s.pending('bad')).toBe(false);
		expect((await s.ensure('a')).file).toBe('a.sqlite');
	});
});
