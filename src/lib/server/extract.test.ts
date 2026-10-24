import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataKey, ensureDataDb, extractorFromEnv, extractorVersion } from './extract.ts';

describe('dataKey', () => {
	it('changes with the version and the DLC set, not their order', () => {
		const a = dataKey('v4.5.2', ['dlc001', 'dlc002']);
		expect(a).toMatch(/^v4\.5\.2-[0-9a-f]{8}$/);
		expect(dataKey('v4.5.2', ['dlc002', 'dlc001'])).toBe(a);
		expect(dataKey('v4.5.2', ['dlc001'])).not.toBe(a);
		expect(dataKey('v4.5.3', ['dlc001', 'dlc002'])).not.toBe(a);
	});

	it("changes with the extractor's version, so an update extracts again", () => {
		const a = dataKey('v4.5.2', ['dlc001'], '0.1.1');
		expect(dataKey('v4.5.2', ['dlc001'], '0.2.0')).not.toBe(a);
		expect(dataKey('v4.5.2', ['dlc001'], '0.1.1')).toBe(a);
	});
});

describe('extractorVersion', () => {
	it('reads __version__ beside the script; null when there is none', () => {
		const dir = mkdtempSync(join(tmpdir(), 'extractor-'));
		mkdirSync(join(dir, 'extractor'));
		writeFileSync(join(dir, 'extractor', '__init__.py'), '"""doc"""\n\n__version__ = \'0.2.0\'\n');
		expect(extractorVersion(join(dir, 'stellaris-extract.py'))).toBe('0.2.0');
		expect(extractorVersion(join(tmpdir(), 'nowhere', 'x.py'))).toBeNull();
	});
});

describe('extractorFromEnv', () => {
	it('needs the script; Python defaults to python3', () => {
		expect(extractorFromEnv({})).toBeNull();
		expect(extractorFromEnv({ STELLARIS_EXTRACTOR: '/x.py' })).toEqual({
			python: 'python3',
			script: '/x.py'
		});
	});
});

describe('ensureDataDb', () => {
	const game = mkdtempSync(join(tmpdir(), 'game-'));
	writeFileSync(join(game, 'launcher-settings.json'), '{ "rawVersion": "v4.5.2" }');
	mkdirSync(join(game, 'dlc', 'dlc001'), { recursive: true });
	// a stand-in extractor: writes the --sqlite target and counts its runs
	const work = mkdtempSync(join(tmpdir(), 'ext-'));
	const script = join(work, 'fake.mjs');
	writeFileSync(
		script,
		`import { appendFileSync, writeFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(join(work, 'runs'))}, 'x');
writeFileSync(process.argv[process.argv.indexOf('--sqlite') + 1], 'db');`
	);
	const node = { python: process.execPath, script };

	it('extracts once per key, then reuses the file', async () => {
		const app = mkdtempSync(join(tmpdir(), 'app-'));
		const file = await ensureDataDb(game, app, node, () => {});
		expect(existsSync(file)).toBe(true);
		expect(await ensureDataDb(game, app, node, () => {})).toBe(file);
		expect(readFileSync(join(work, 'runs'), 'utf8')).toBe('x');
	});
	it('reports a missing Python plainly', async () => {
		const app = mkdtempSync(join(tmpdir(), 'app-'));
		await expect(
			ensureDataDb(game, app, { python: 'no-such-python-xyz', script }, () => {})
		).rejects.toThrow(/not found/);
	});
	it('fails without an extractor when there is no data yet', async () => {
		const app = mkdtempSync(join(tmpdir(), 'app-'));
		await expect(ensureDataDb(game, app, null, () => {})).rejects.toThrow(/no extractor/);
	});
});
