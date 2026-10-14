import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { history, nodes, openDb } from './db.ts';
import { campaignOf, watchSaves, type Ingested } from './watch.ts';

// A tiny but real save: zip of meta + gamestate in the game's text format, parsed by jomini.
function writeSave(dir: string, name: string, date: string, randomCount: number, energy: number) {
	const work = mkdtempSync(join(tmpdir(), 'sav-'));
	writeFileSync(join(work, 'meta'), `name="Test Empire"\ndate="${date}"\n`);
	writeFileSync(
		join(work, 'gamestate'),
		`date="${date}"\ntick=1\nrandom_count=${randomCount}\nplayer={ { name="me" country=0 } }\n` +
			`country={ 0={ num_sapient_pops=100 controlled_colonies={ 0 }\n` +
			`  modules={ standard_economy_module={ resources={ energy=${energy} } } } } }\n` +
			`colony={ 0={ num_sapient_pops=100 final_designation="col_capital" } }\n`
	);
	const tmp = join(work, 'out.sav');
	execFileSync('zip', ['-q', tmp, 'meta', 'gamestate'], { cwd: work });
	renameSync(tmp, join(dir, name)); // atomic, like a finished save
	return join(dir, name);
}

const until = async (cond: () => boolean, ms = 5000) => {
	for (const end = Date.now() + ms; !cond();) {
		if (Date.now() > end) throw new Error('timed out');
		await new Promise((r) => setTimeout(r, 25));
	}
};

describe('campaignOf', () => {
	it('is the first folder below the save root', () => {
		expect(campaignOf('/s', '/s/empire_1/autosave_2200.sav')).toBe('empire_1');
	});
});

describe('watchSaves', () => {
	it('backfills existing saves in mtime order, then ingests new ones as they appear', async () => {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		const camp = join(root, 'empire_1');
		mkdirSync(camp);
		const older = writeSave(camp, 'b.sav', '2200.01.01', 1, 10);
		const newer = writeSave(camp, 'a.sav', '2201.01.01', 2, 20);
		utimesSync(older, 1000, 1000);
		utimesSync(newer, 2000, 2000); // name order would be wrong; mtime order is right

		const db = openDb(':memory:');
		const seen: Ingested[] = [];
		const errors: unknown[] = [];
		const stop = await watchSaves(db, root, {
			onIngest: (r) => seen.push(r),
			onError: (_f, e) => errors.push(e),
			intervalMs: 50
		});
		try {
			expect(nodes(db).map((n) => n.date)).toEqual(['2200.01.01', '2201.01.01']);

			writeSave(camp, 'autosave_2202.sav', '2202.01.01', 3, 30);
			await until(() => seen.length === 3);
			const head = seen[2].nodeId;
			expect(history(db, head).map((s) => s.stockpile.energy)).toEqual([10, 20, 30]);
			expect(errors).toEqual([]);
		} finally {
			stop();
		}
	});

	it('ingests a save that was incomplete at first', async () => {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		const camp = join(root, 'empire_1');
		mkdirSync(camp);
		const db = openDb(':memory:');
		const errors: string[] = [];
		const stop = await watchSaves(db, root, {
			onIngest: () => {},
			onError: (f) => errors.push(f),
			intervalMs: 20,
			retries: 50
		});
		try {
			writeFileSync(join(camp, 'autosave.sav'), 'PK half written');
			await new Promise((r) => setTimeout(r, 100)); // a few failed attempts
			expect(nodes(db)).toEqual([]);
			writeSave(camp, 'autosave.sav', '2200.01.01', 1, 10);
			await until(() => nodes(db).length === 1);
			expect(errors).toEqual([]);
		} finally {
			stop();
		}
	});

	it('reports a save that never becomes valid, once', async () => {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		mkdirSync(join(root, 'empire_1'));
		const db = openDb(':memory:');
		const errors: string[] = [];
		const stop = await watchSaves(db, root, {
			onIngest: () => {},
			onError: (f) => errors.push(f),
			intervalMs: 20,
			retries: 2
		});
		try {
			writeFileSync(join(root, 'empire_1', 'broken.sav'), 'not a zip');
			await until(() => errors.length === 1);
			await new Promise((r) => setTimeout(r, 100)); // further polls must stay quiet
			expect(errors).toHaveLength(1);
			expect(nodes(db)).toEqual([]);
		} finally {
			stop();
		}
	});
});
