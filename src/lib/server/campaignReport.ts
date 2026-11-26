import { campaignRows } from './campaigns.ts';
import { headId, type Db } from './db.ts';

// What `scripts/campaigns.mjs` prints: every campaign in a dashboard DB, or one in detail. Read
// only — the script opens the DB read-only, so it is safe beside a running dashboard.

export type CampaignSummary = {
	campaign: string;
	name: string;
	firstDate: string;
	lastDate: string;
	nodes: number;
	/** when the dashboard recorded the campaign's last node (ISO, UTC) */
	lastObserved: string;
	/** the game version of the latest save ('' without one) */
	version: string;
	head: boolean;
};

export type TimelineRow = {
	seq: number;
	id: number;
	date: string;
	kind: string;
	source: string;
	observedAt: string;
	parentSeq: number | null;
	/** this node has more than one child: the campaign branches here */
	branches: boolean;
	ambiguous: boolean;
	head: boolean;
};

export type CampaignDetail = CampaignSummary & {
	countryId: number | null;
	origin: string;
	government: string;
	/** every game version its saves were read from, oldest first */
	versions: string[];
	galaxy: string;
	ironman: boolean;
	multiplayer: boolean;
	saves: number;
	logNodes: number;
	branchPoints: number;
	planEvents: number;
	/** the newest nodes, newest first */
	timeline: TimelineRow[];
};

const headCampaignOf = (db: Db, head: number | null) =>
	head === null
		? null
		: ((
				db.prepare('SELECT campaign FROM node WHERE id = ?').get(head) as
					{ campaign: string } | undefined
			)?.campaign ?? null);

/** Every campaign in the DB, most recently observed first. */
export function campaignSummaries(db: Db): CampaignSummary[] {
	const head = headCampaignOf(db, headId(db));
	const extra = db.prepare(
		`SELECT min(n.date) AS firstDate, max(n.observed_at) AS lastObserved,
			(SELECT json_extract(s.json, '$.gameVersion') FROM node m JOIN snapshot s ON s.node_id = m.id
			 WHERE m.campaign = n.campaign AND m.kind = 'save' ORDER BY m.id DESC LIMIT 1) AS version
		FROM node n WHERE n.campaign = ?`
	);
	return campaignRows(db, new Set()).map((r) => {
		const e = extra.get(r.campaign) as {
			firstDate: string;
			lastObserved: string;
			version: string | null;
		};
		return {
			campaign: r.campaign,
			name: r.name,
			firstDate: e.firstDate,
			lastDate: r.date,
			nodes: r.nodes,
			lastObserved: e.lastObserved,
			version: e.version ?? '',
			head: r.campaign === head
		};
	});
}

/** The campaigns whose id contains `query` (an exact id wins over substrings). */
export function matchCampaigns(campaigns: string[], query: string): string[] {
	if (campaigns.includes(query)) return [query];
	const q = query.toLowerCase();
	return campaigns.filter((c) => c.toLowerCase().includes(q));
}

/** One campaign in detail, with its `limit` newest nodes; undefined for an unknown campaign. */
export function campaignDetail(
	db: Db,
	campaign: string,
	limit: number
): CampaignDetail | undefined {
	const summary = campaignSummaries(db).find((s) => s.campaign === campaign);
	if (!summary) return undefined;
	const head = headId(db);
	const latest = db
		.prepare(
			`SELECT json_extract(s.json, '$.countryId') AS countryId, json_extract(s.json, '$.origin') AS origin,
				json_extract(s.json, '$.governmentType') AS government,
				json_extract(s.json, '$.galaxySetup.template') AS template,
				json_extract(s.json, '$.galaxySetup.num_empires') AS empires,
				json_extract(s.json, '$.galaxySetup.ironman') AS ironman,
				json_extract(s.json, '$.multiplayer') AS multiplayer
			FROM node n JOIN snapshot s ON s.node_id = n.id
			WHERE n.campaign = ? AND n.kind = 'save' ORDER BY n.id DESC LIMIT 1`
		)
		.get(campaign) as Record<string, string | number | null> | undefined;
	const versions = (
		db
			.prepare(
				`SELECT json_extract(s.json, '$.gameVersion') AS v, min(n.id) AS first
				FROM node n JOIN snapshot s ON s.node_id = n.id
				WHERE n.campaign = ? AND n.kind = 'save' GROUP BY v HAVING v IS NOT NULL ORDER BY first`
			)
			.all(campaign) as { v: string }[]
	).map((r) => r.v);
	const count = (sql: string) => (db.prepare(sql).get(campaign) as { n: number }).n;
	const children = new Map(
		(
			db
				.prepare(
					'SELECT parent_id AS p, count(*) AS n FROM node WHERE campaign = ? AND parent_id IS NOT NULL GROUP BY parent_id'
				)
				.all(campaign) as { p: number; n: number }[]
		).map((r) => [r.p, r.n])
	);
	const rows = db
		.prepare(
			`SELECT n.id, coalesce(n.seq, n.id) AS seq, n.date, n.kind, n.source, n.observed_at AS observedAt,
				n.ambiguous, coalesce(p.seq, p.id) AS parentSeq
			FROM node n LEFT JOIN node p ON p.id = n.parent_id
			WHERE n.campaign = ? ORDER BY n.id DESC LIMIT ?`
		)
		.all(campaign, limit) as {
		id: number;
		seq: number;
		date: string;
		kind: string;
		source: string;
		observedAt: string;
		ambiguous: number;
		parentSeq: number | null;
	}[];
	const galaxy = [latest?.template, latest?.empires != null ? `${latest.empires} empires` : null]
		.filter(Boolean)
		.join(', ');
	return {
		...summary,
		countryId: (latest?.countryId as number | null) ?? null,
		origin: String(latest?.origin ?? ''),
		government: String(latest?.government ?? ''),
		versions,
		galaxy,
		ironman: latest?.ironman === 1 || latest?.ironman === 'yes',
		multiplayer: latest?.multiplayer === 1,
		saves: count("SELECT count(*) AS n FROM node WHERE campaign = ? AND kind = 'save'"),
		logNodes: count("SELECT count(*) AS n FROM node WHERE campaign = ? AND kind = 'log'"),
		branchPoints: [...children.values()].filter((n) => n > 1).length,
		planEvents: count('SELECT count(*) AS n FROM plan_event WHERE campaign = ?'),
		timeline: rows.map((r) => ({
			seq: r.seq,
			id: r.id,
			date: r.date,
			kind: r.kind,
			source: r.source,
			observedAt: r.observedAt,
			parentSeq: r.parentSeq,
			branches: (children.get(r.id) ?? 0) > 1,
			ambiguous: r.ambiguous === 1,
			head: r.id === head
		}))
	};
}

/** A save on disk: its path relative to the save folder, as `save_file` keys it. */
export type DiskSave = { path: string; mtimeMs: number };

/** The saves on disk the DB has never read (not in `save_file`), newest first. */
export function unreadSaves(db: Db, onDisk: DiskSave[]): DiskSave[] {
	const read = new Set(
		(db.prepare('SELECT path FROM save_file').all() as { path: string }[]).map((r) => r.path)
	);
	return onDisk.filter((s) => !read.has(s.path)).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** `2026-11-22T18:13:34.581Z` → `2026-11-22 19:13` in the local time zone. */
export const localTime = (iso: string | number): string =>
	new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

/** Rows as a plain-text table, columns padded to their widest cell. */
export function table(header: string[], rows: string[][]): string {
	const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
	const line = (cells: string[]) =>
		cells
			.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i])))
			.join('  ')
			.trimEnd();
	return [line(header), ...rows.map(line)].join('\n');
}
