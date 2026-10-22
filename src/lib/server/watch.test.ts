import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deleteCampaign, headCampaign, headId, history, nodes, openDb } from './db.ts';
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
		const { stop } = await watchSaves(db, root, {
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
		const { stop } = await watchSaves(db, root, {
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
		const { stop } = await watchSaves(db, root, {
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

	it('reads at start only what changed since the last run', async () => {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		const camp = join(root, 'empire_1');
		mkdirSync(camp);
		const a = writeSave(camp, 'a.sav', '2200.01.01', 1, 10);
		writeSave(camp, 'b.sav', '2201.01.01', 2, 20);
		const db = openDb(':memory:');
		const run = async () => {
			const seen: string[] = [];
			const w = await watchSaves(db, root, {
				onIngest: (r) => seen.push(r.file),
				onError: (_f, e) => {
					throw e;
				},
				reader: 'r1'
			});
			w.stop();
			return seen;
		};
		expect(await run()).toHaveLength(2);
		expect(await run()).toEqual([]);
		utimesSync(a, 5000, 5000); // the control: a changed file is read again
		expect(await run()).toEqual([a]);
	});

	it('re-reads saves of an older reader: the head campaign at start, another once asked', async () => {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		mkdirSync(join(root, 'empire_1'));
		mkdirSync(join(root, 'empire_2'));
		const old = writeSave(join(root, 'empire_1'), 'a.sav', '2200.01.01', 1, 10);
		const played = writeSave(join(root, 'empire_2'), 'b.sav', '2230.01.01', 2, 20);
		utimesSync(old, 1000, 1000);
		utimesSync(played, 2000, 2000);
		const db = openDb(':memory:');
		const quiet = { onIngest: () => {}, onError: () => {} };
		const w1 = await watchSaves(db, root, { ...quiet, reader: 'r1' });
		await w1.catchUp();
		w1.stop();
		const head = headId(db);

		const reread: string[] = [];
		const ingested: string[] = [];
		const w = await watchSaves(db, root, {
			...quiet,
			onIngest: (r) => ingested.push(r.file),
			onRefresh: (r) => reread.push(r.file),
			reader: 'r2'
		});
		try {
			expect(ingested).toEqual([]);
			expect(reread).toEqual([played]);
			expect(await w.refreshCampaign('empire_1')).toBe(1);
			expect(reread).toEqual([played, old]);
			expect(headId(db)).toBe(head); // a re-read is no observation
			expect(await w.refreshCampaign('empire_1')).toBe(0);
		} finally {
			w.stop();
		}
	});
});

describe('starting with several campaigns', () => {
	// three campaigns, `played` last, each with two saves
	function setup() {
		const root = mkdtempSync(join(tmpdir(), 'saves-'));
		const files: Record<string, string[]> = {};
		let t = 1000;
		for (const [c, year] of [
			['oldest', 2200],
			['played', 2300],
			['middle', 2250]
		] as const) {
			mkdirSync(join(root, c));
			files[c] = [1, 2].map((m) => {
				const f = writeSave(join(root, c), `${m}.sav`, `${year}.0${m}.01`, year + m, m);
				utimesSync(f, (t += 10), t);
				return f;
			});
		}
		// `played` holds the newest save, `middle` the next
		utimesSync(files.played[1], 5000, 5000);
		return { root, files };
	}
	const quiet = {
		onIngest: () => {},
		onError: (_f: string, e: unknown) => {
			throw e;
		}
	};
	const campaigns = (db: ReturnType<typeof openDb>) => [
		...new Set(nodes(db).map((n) => n.campaign))
	];

	it("reads only the newest save's campaign at first, the others in the background, newest first", async () => {
		const { root } = setup();
		const db = openDb(':memory:');
		const w = await watchSaves(db, root, { ...quiet, intervalMs: 50 });
		try {
			expect(campaigns(db)).toEqual(['played']);
			const head = headId(db);
			const order: [string, number][] = [];
			await w.catchUp((c, n) => order.push([c, n]));
			expect(order).toEqual([
				['middle', 2],
				['oldest', 2]
			]);
			expect(headId(db)).toBe(head); // the background is no observation
			const middle = nodes(db).filter((n) => n.campaign === 'middle');
			expect(middle.map((n) => n.parentId)).toEqual([null, middle[0].id]);
			expect(w.onDisk()).toEqual(new Set(['oldest', 'played', 'middle']));
		} finally {
			w.stop();
		}
	});

	it('reads the head campaign at a later start, even when another holds newer saves', async () => {
		const { root } = setup();
		const db = openDb(':memory:');
		const w1 = await watchSaves(db, root, quiet);
		await w1.catchUp();
		w1.stop();
		const before = nodes(db).length;
		expect(headCampaign(db)).toBe('played');
		// meanwhile the player went on in `oldest`, then in `played`, then in `middle`
		for (const [c, at] of [
			['oldest', 6000],
			['played', 7000],
			['middle', 8000]
		] as const) {
			writeSave(join(root, c), 'new.sav', '2400.01.01', at, 9);
			utimesSync(join(root, c, 'new.sav'), at, at);
		}
		const w = await watchSaves(db, root, quiet);
		try {
			expect(nodes(db).length).toBe(before + 1);
			expect(nodes(db).at(-1)?.campaign).toBe('played');
			const order: string[] = [];
			await w.catchUp((c) => order.push(c));
			expect(order).toEqual(['middle', 'oldest']);
			expect(nodes(db).length).toBe(before + 3);
			expect(headCampaign(db)).toBe('played');
		} finally {
			w.stop();
		}
	});

	it('reads a campaign played before its turn at once: what came before first', async () => {
		const { root } = setup();
		const db = openDb(':memory:');
		const seen: Ingested[] = [];
		const w = await watchSaves(db, root, {
			...quiet,
			onIngest: (r) => seen.push(r),
			intervalMs: 20
		});
		try {
			writeSave(join(root, 'oldest'), '3.sav', '2200.03.01', 2203, 3);
			await until(() => seen.some((r) => r.file.endsWith('3.sav')));
			const oldest = nodes(db).filter((n) => n.campaign === 'oldest');
			expect(oldest.map((n) => n.date)).toEqual(['2200.01.01', '2200.02.01', '2200.03.01']);
			expect(oldest.map((n) => n.parentId)).toEqual([null, oldest[0].id, oldest[1].id]);
			expect(headCampaign(db)).toBe('oldest'); // a live save is an observation
			const order: string[] = [];
			await w.catchUp((c) => order.push(c));
			expect(order).toEqual(['middle']); // nothing of `oldest` left
		} finally {
			w.stop();
		}
	});

	it('does not read a deleted campaign back in, not even for a newer reader', async () => {
		const { root } = setup();
		const db = openDb(':memory:');
		const w1 = await watchSaves(db, root, { ...quiet, reader: 'r1' });
		await w1.catchUp();
		w1.stop();
		deleteCampaign(db, 'oldest');
		const w = await watchSaves(db, root, { ...quiet, reader: 'r2' });
		try {
			await w.catchUp();
			expect(campaigns(db).sort()).toEqual(['middle', 'played']);
		} finally {
			w.stop();
		}
	});
});
