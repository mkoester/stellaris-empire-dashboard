#!/usr/bin/env node
// Renders every page of the dashboard on a copy of a dashboard DB and fails on what the server
// says while rendering: Svelte's dev-only warnings (node_invalid_placement_ssr, state and
// ownership warnings …), errors, and any response other than 200. These are logged, never thrown,
// so neither svelte-check nor the unit tests see them.
//
// Each campaign's newest node is rendered twice: with its display switches as stored, and with
// every switch on (spoilers and cheats included), so the parts behind a switch render too.
// The DB is copied first; the dev server reads no saves (an empty save folder) and no game.log.
// Client-side warnings (hydration_mismatch) need a browser and are not covered.
//
// Usage: node scripts/check-pages.mjs --db <dashboard.sqlite> --data <stellaris.sqlite>
//                                     [--campaign <substring>]… [--route </path>]…
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DatabaseSync, backup } from 'node:sqlite';
import { SWITCHES } from '../src/lib/displaySwitches.ts';

const root = resolve(import.meta.dirname, '..');
const PORT = 5287;
const BASE = `http://127.0.0.1:${PORT}`;
// what the server prints while rendering that is a finding (the lines of a stack trace included)
const PROBLEM = /node_invalid_placement|hydration|svelte\.dev\/e\/|\bwarn(ing)?\b|\berror\b/i;
// what the copy's setup itself causes: no launcher DB beside the copied dashboard DB
const EXPECTED = /cannot read the launcher's playsets/;

const { values: opt } = parseArgs({
	options: {
		db: { type: 'string' },
		data: { type: 'string' },
		campaign: { type: 'string', multiple: true, default: [] },
		route: { type: 'string', multiple: true, default: [] }
	}
});
if (!opt.db || !opt.data) {
	console.error('usage: check-pages.mjs --db <dashboard.sqlite> --data <stellaris.sqlite>');
	process.exit(2);
}

/** Every page route as a path pattern (`/colony/[id]`), from src/routes. */
function pageRoutes(dir) {
	const walk = (d) =>
		readdirSync(d).flatMap((f) => {
			const p = join(d, f);
			if (statSync(p).isDirectory()) return walk(p);
			return f === '+page.svelte' ? ['/' + relative(dir, d).split('\\').join('/')] : [];
		});
	return walk(dir)
		.map((r) => (r === '/' ? r : r.replace(/\/$/, '')))
		.filter((r) => !r.startsWith('/setup')) // the first-run page: its own state, not a campaign's
		.sort();
}

/** A concrete path for a route with parameters: the first link to one in the pages seen so far
 *  (SvelteKit writes them relative: `./colony/3?node=…`). */
function concrete(route, html) {
	const re = new RegExp(
		'href="\\.{0,2}(' + route.replace(/\[[^\]]+\]/g, '[^/?"#]+').replace(/\//g, '\\/') + ')[?"#]'
	);
	return html.match(re)?.[1] ?? null;
}

const work = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'check-pages-'));
const dbCopy = join(work, 'dashboard.sqlite');
const source = new DatabaseSync(`file:${resolve(opt.db)}?mode=ro`, { readOnly: true });
await backup(source, dbCopy);
source.close();
mkdirSync(join(work, 'saves'));

const db = new DatabaseSync(dbCopy, { readOnly: true });
const tips = db
	.prepare('SELECT campaign, MAX(id) AS node FROM node GROUP BY campaign ORDER BY campaign')
	.all()
	.filter((t) => !opt.campaign.length || opt.campaign.some((c) => t.campaign.includes(c)));
db.close();

let out = ''; // everything the server printed
const server = spawn(
	join(root, 'node_modules/.bin/vite'),
	['dev', '--strictPort', '--port', String(PORT), '--host', '127.0.0.1'],
	{
		cwd: root,
		env: {
			...process.env,
			DASHBOARD_DB: dbCopy,
			STELLARIS_SAVE_DIR: join(work, 'saves'),
			STELLARIS_DATA_DB: resolve(opt.data),
			XDG_DATA_HOME: join(work, 'xdg')
		},
		stdio: ['ignore', 'pipe', 'pipe']
	}
);
server.stdout.on('data', (b) => (out += b));
server.stderr.on('data', (b) => (out += b));
const stop = () => {
	server.kill();
	rmSync(work, { recursive: true, force: true });
};

const findings = [];
try {
	// up once a page renders instead of leading to /setup
	for (let i = 0; ; i++) {
		const r = await fetch(`${BASE}/about`, { redirect: 'manual' }).catch(() => null);
		if (r?.status === 200) break;
		if (i > 240 || server.exitCode !== null) throw new Error(`server did not start:\n${out}`);
		await new Promise((ok) => setTimeout(ok, 500));
	}
	const startLog = out.length;
	const routes = opt.route.length ? opt.route : pageRoutes(join(root, 'src/routes'));

	const put = (display) =>
		fetch(`${BASE}/api/settings`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json', origin: BASE },
			body: JSON.stringify({ display })
		}).then((r) => {
			if (!r.ok) throw new Error(`PUT /api/settings: ${r.status}`);
		});
	const allOn = {
		showSpoilers: true,
		showCheats: true,
		...Object.fromEntries(SWITCHES.map((s) => [s.key, true]))
	};

	let pages = 0;
	for (const [pass, display] of [
		['stored', null],
		['all switches on', allOn]
	]) {
		if (display) await put(display);
		for (const { campaign, node } of tips) {
			let seen = '';
			const deferred = [];
			const visit = async (path) => {
				const url = `${path}?node=${node}`;
				const from = out.length;
				const t = Date.now();
				const r = await fetch(BASE + url, { redirect: 'manual' });
				const html = await r.text();
				pages++;
				seen += html;
				// let the server's output for this request arrive
				await new Promise((ok) => setTimeout(ok, 20));
				const said = out
					.slice(from)
					.split('\n')
					.filter((l) => PROBLEM.test(l) && !EXPECTED.test(l));
				// dev SSR also writes its placement errors into the page as console.error(…)
				const inPage = html.match(/<script>console\.error\([^<]*/g) ?? [];
				if (r.status !== 200 || said.length || inPage.length)
					findings.push({ pass, campaign, url, status: r.status, lines: [...said, ...inPage] });
				process.stderr.write(
					`${r.status} ${String(Date.now() - t).padStart(5)} ms  ${pass} · ${campaign} · ${url}\n`
				);
			};
			for (const route of routes)
				if (route.includes('[')) deferred.push(route);
				else await visit(route);
			for (const route of deferred) {
				const path = concrete(route, seen);
				if (path) await visit(path);
				else process.stderr.write(`  -  no link to ${route} · ${campaign}\n`);
			}
		}
	}

	const late = out.slice(startLog);
	console.log(`\n${pages} pages rendered, ${findings.length} with findings.`);
	for (const f of findings) {
		console.log(`\n${f.status} ${f.url}  (${f.campaign}, ${f.pass})`);
		for (const l of f.lines) console.log(`    ${l}`);
	}
	if (!findings.length && late.split('\n').some((l) => PROBLEM.test(l) && !EXPECTED.test(l)))
		console.log('\nThe server printed warnings outside any page request:\n' + late);
	process.exitCode = findings.length ? 1 : 0;
} finally {
	stop();
}
