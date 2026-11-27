import { describe, expect, it } from 'vitest';
import {
	campaignDetail,
	campaignSummaries,
	matchCampaigns,
	table,
	unreadSaves
} from './campaignReport.ts';
import { openDb, type Db } from './db.ts';

/** Nodes inserted the way `record` leaves them, with just the snapshot fields the report reads. */
function seed(): Db {
	const db = openDb(':memory:');
	const node = db.prepare(
		`INSERT INTO node (id, kind, campaign, date, fingerprint, parent_id, source, observed_at, seq)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const snap = db.prepare('INSERT INTO snapshot (node_id, json) VALUES (?, ?)');
	const add = (
		id: number,
		campaign: string,
		date: string,
		parent: number | null,
		seq: number,
		json: object,
		kind = 'save'
	) => {
		node.run(
			id,
			kind,
			campaign,
			date,
			`f${id}`,
			parent,
			`${campaign}/${date}.sav`,
			`2026-11-2${seq}T10:00:00.000Z`,
			seq
		);
		snap.run(id, JSON.stringify(json));
	};
	const old = { empireName: 'Old', gameVersion: 'Cygnus v4.5.2', countryId: 0 };
	add(1, 'a', '2200.01.01', null, 1, old);
	add(2, 'b', '2200.01.01', null, 1, { empireName: 'B', gameVersion: 'Cygnus v4.5.2' });
	add(3, 'a', '2201.01.01', 1, 2, old);
	add(4, 'a', '2200.06.01', 1, 3, {
		...old,
		empireName: 'New',
		gameVersion: 'Cygnus v4.5.4',
		galaxySetup: { template: 'huge', num_empires: 30 }
	});
	add(5, 'a', '2200.07.01', 4, 4, {}, 'log');
	db.exec("INSERT INTO state (key, value) VALUES ('head', '5')");
	return db;
}

describe('campaignSummaries', () => {
	it('lists every campaign, most recently recorded first, with the head marked', () => {
		const s = campaignSummaries(seed());
		expect(
			s.map((c) => [c.campaign, c.name, c.firstDate, c.lastDate, c.nodes, c.version, c.head])
		).toEqual([
			['a', 'New', '2200.01.01', '2201.01.01', 4, 'Cygnus v4.5.4', true],
			['b', 'B', '2200.01.01', '2200.01.01', 1, 'Cygnus v4.5.2', false]
		]);
	});
});

describe('campaignDetail', () => {
	it('reads the latest save, every version, the branches and the newest nodes', () => {
		const d = campaignDetail(seed(), 'a', 3)!;
		expect(d.name).toBe('New');
		expect(d.versions).toEqual(['Cygnus v4.5.2', 'Cygnus v4.5.4']);
		expect(d.galaxy).toBe('huge, 30 empires');
		expect([d.saves, d.logNodes, d.branchPoints]).toEqual([3, 1, 1]);
		expect(d.timeline.map((r) => [r.seq, r.parentSeq, r.branches, r.head])).toEqual([
			[4, 3, false, true],
			[3, 1, false, false],
			[2, 1, false, false]
		]);
	});
	it('marks the node a campaign branches at', () => {
		const d = campaignDetail(seed(), 'a', 10)!;
		expect(d.timeline.find((r) => r.seq === 1)?.branches).toBe(true);
	});
	it('is undefined for an unknown campaign', () => {
		expect(campaignDetail(seed(), 'zzz', 5)).toBeUndefined();
	});
});

describe('matchCampaigns', () => {
	const ids = ['roamingcybergang_1', 'roamingcybergang2_2', 'unitednations_3'];
	it('matches a part of an id, ignoring case', () => {
		expect(matchCampaigns(ids, 'CYBER')).toEqual(['roamingcybergang_1', 'roamingcybergang2_2']);
	});
	it('prefers an exact id over the ids that contain it', () => {
		expect(matchCampaigns(['ab', 'abc'], 'ab')).toEqual(['ab']);
	});
});

describe('unreadSaves', () => {
	it('keeps the saves save_file does not know, newest first', () => {
		const db = seed();
		db.prepare(
			"INSERT INTO save_file (path, version, reader) VALUES ('a/x.sav', '1:1', '1')"
		).run();
		const out = unreadSaves(db, [
			{ path: 'a/x.sav', mtimeMs: 3 },
			{ path: 'a/y.sav', mtimeMs: 1 },
			{ path: 'a/z.sav', mtimeMs: 2 }
		]);
		expect(out.map((s) => s.path)).toEqual(['a/z.sav', 'a/y.sav']);
	});
});

describe('table', () => {
	it('pads every column but the last to its widest cell', () => {
		expect(
			table(
				['a', 'bb', 'c'],
				[
					['xxx', 'y', 'z'],
					['', '', '']
				]
			)
		).toBe('a    bb  c\nxxx  y   z\n');
	});
});
