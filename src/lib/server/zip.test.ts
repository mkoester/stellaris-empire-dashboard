import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readZipEntry } from './zip.ts';

// Built with the system `zip`, so the reader is checked against a real writer, not against itself.
function makeZip(files: Record<string, string>, store = false): Uint8Array {
	const dir = mkdtempSync(join(tmpdir(), 'zip-test-'));
	for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
	const out = join(dir, 'out.zip');
	execFileSync('zip', ['-q', ...(store ? ['-0'] : []), out, ...Object.keys(files)], { cwd: dir });
	return readFileSync(out);
}

describe('readZipEntry', () => {
	const files = { meta: 'date="2200.01.01"\n', gamestate: 'x=1\n'.repeat(5000) };

	it('extracts deflated entries by name', () => {
		const zip = makeZip(files);
		expect(Buffer.from(readZipEntry(zip, 'gamestate')).toString()).toBe(files.gamestate);
		expect(Buffer.from(readZipEntry(zip, 'meta')).toString()).toBe(files.meta);
	});

	it('extracts stored entries', () => {
		const zip = makeZip(files, true);
		expect(Buffer.from(readZipEntry(zip, 'meta')).toString()).toBe(files.meta);
	});

	it('throws on a missing entry', () => {
		expect(() => readZipEntry(makeZip(files), 'nope')).toThrow(/no entry/);
	});

	it('throws on a truncated file, as a save still being written looks', () => {
		const zip = makeZip(files);
		expect(() => readZipEntry(zip.subarray(0, zip.length - 30), 'meta')).toThrow();
	});
});
