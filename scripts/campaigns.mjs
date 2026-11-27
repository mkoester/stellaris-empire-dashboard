#!/usr/bin/env node
// Lists the campaigns in a dashboard DB, or shows one in detail: its empire, game versions, the
// newest nodes of its timeline, and the saves on disk the DB has never read (a session played
// without this DB running). Opens the DB read-only: safe beside a running dashboard.
//
// Usage: node scripts/campaigns.mjs [<campaign>] [--db <dashboard.sqlite>] [--save-dir <dir>]
//                                   [--limit <n>]
//   <campaign>  an id or a part of one (case-insensitive); without it, every campaign
//   --db        default: the player's DB (DASHBOARD_DB, else <app data>/dashboard.sqlite)
//   --save-dir  default: STELLARIS_SAVE_DIR, else the user dir from the app's config.json
//   --limit     timeline rows to show (default 15)
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { appDataDir, readConfig, saveDirOf } from '../src/lib/server/config.ts';
import { VERSION } from '../src/lib/server/db.ts';
import {
	campaignDetail,
	campaignSummaries,
	localTime,
	matchCampaigns,
	table,
	unreadSaves
} from '../src/lib/server/campaignReport.ts';

const die = (msg) => {
	console.error(`campaigns: ${msg}`);
	process.exit(2);
};

const { values: opt, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		db: { type: 'string' },
		'save-dir': { type: 'string' },
		limit: { type: 'string', default: '15' },
		help: { type: 'boolean', short: 'h' }
	}
});
if (opt.help) {
	console.log(
		'usage: campaigns.mjs [<campaign>] [--db <dashboard.sqlite>] [--save-dir <dir>] [--limit <n>]'
	);
	process.exit(0);
}
if (positionals.length > 1) die('one campaign at a time');
const limit = Number(opt.limit);
if (!Number.isInteger(limit) || limit < 1)
	die(`--limit takes a positive number, not '${opt.limit}'`);

const appDir = appDataDir(process.platform, process.env, homedir());
const dbFile = opt.db || process.env.DASHBOARD_DB || join(appDir, 'dashboard.sqlite');
if (!existsSync(dbFile)) die(`no DB at ${dbFile}`);
const userDir = readConfig(appDir).userDir;
const saveDir =
	opt['save-dir'] || process.env.STELLARIS_SAVE_DIR || (userDir && saveDirOf(userDir));

const db = new DatabaseSync(dbFile, { readOnly: true });
const version = db.prepare('PRAGMA user_version').get().user_version;
const newer = version > VERSION ? ` — newer than this checkout's v${VERSION}, read anyway` : '';

/** The `.sav` files of one campaign folder (or of all), keyed as `save_file` keys them. */
function diskSaves(campaign) {
	if (!saveDir || !existsSync(saveDir)) return null;
	const folders = campaign ? [campaign] : readdirSync(saveDir);
	return folders.flatMap((c) => {
		const dir = join(saveDir, c);
		if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
		return readdirSync(dir)
			.filter((f) => f.endsWith('.sav'))
			.map((f) => ({ path: `${c}/${f}`, mtimeMs: statSync(join(dir, f)).mtimeMs }));
	});
}

const summaries = campaignSummaries(db);
console.log(`db:    ${dbFile} (schema v${version}${newer})`);
console.log(`saves: ${saveDir && existsSync(saveDir) ? saveDir : '(unknown: pass --save-dir)'}\n`);

if (positionals.length === 0) {
	const disk = diskSaves(null);
	const perCampaign = (c) => disk?.filter((s) => s.path.startsWith(`${c}/`)) ?? null;
	const rows = summaries.map((s) => {
		const own = perCampaign(s.campaign);
		return [
			s.head ? '*' : '',
			s.campaign,
			s.name,
			`${s.firstDate}–${s.lastDate}`,
			String(s.nodes),
			localTime(s.lastObserved),
			s.version.replace(/^\S+ v/, ''),
			own === null ? '?' : String(own.length),
			own === null ? '?' : String(unreadSaves(db, own).length)
		];
	});
	console.log(
		table(
			[
				'',
				'campaign',
				'empire',
				'game dates',
				'nodes',
				'last recorded',
				'version',
				'on disk',
				'unread'
			],
			rows
		)
	);
	const strays =
		disk &&
		unreadSaves(db, disk).filter(
			(s) => !summaries.some((c) => s.path.startsWith(`${c.campaign}/`))
		);
	if (strays?.length)
		console.log(
			`\n${strays.length} unread saves in campaigns not in the DB (newest: ${strays[0].path})`
		);
	console.log(
		'\n* = the head (the campaign the dashboard follows). unread = saves on disk the DB never read.'
	);
	process.exit(0);
}

const found = matchCampaigns(
	summaries.map((s) => s.campaign),
	positionals[0]
);
if (found.length === 0) die(`no campaign matches '${positionals[0]}'`);
if (found.length > 1) die(`'${positionals[0]}' matches several:\n  ${found.join('\n  ')}`);
const d = campaignDetail(db, found[0], limit);

const yesNo = (b) => (b ? 'yes' : 'no');
console.log(`${d.campaign}${d.head ? '  (head)' : ''}
  empire:     ${d.name || '?'} (country ${d.countryId ?? '?'}), ${d.origin || '?'}, ${d.government || '?'}
  galaxy:     ${d.galaxy || '?'}; ironman ${yesNo(d.ironman)}, multiplayer ${yesNo(d.multiplayer)}
  game dates: ${d.firstDate} – ${d.lastDate}
  versions:   ${d.versions.join(', ') || '?'}
  nodes:      ${d.nodes} (${d.saves} saves, ${d.logNodes} game.log months), ${d.branchPoints} branch points
  plan:       ${d.planEvents} planner events
  recorded:   last ${localTime(d.lastObserved)}
`);
console.log(
	`newest ${d.timeline.length} of ${d.nodes} nodes (> = branches here, ? = parent guessed):`
);
console.log(
	table(
		['#', 'date', 'kind', 'parent', 'recorded', 'source'],
		d.timeline.map((r) => [
			`${r.head ? '*' : ''}${r.seq}${r.branches ? '>' : ''}${r.ambiguous ? '?' : ''}`,
			r.date,
			r.kind,
			r.parentSeq === null ? '' : `#${r.parentSeq}`,
			localTime(r.observedAt),
			r.source
		])
	)
);
const disk = diskSaves(d.campaign);
if (disk === null) console.log('\nsaves on disk: unknown (pass --save-dir)');
else {
	const unread = unreadSaves(db, disk);
	console.log(`\nsaves on disk: ${disk.length}, never read by this DB: ${unread.length}`);
	if (unread.length)
		console.log(
			table(
				['saved', 'file'],
				unread.map((s) => [localTime(s.mtimeMs), s.path.slice(d.campaign.length + 1)])
			)
		);
}
