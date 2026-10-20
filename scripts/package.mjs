#!/usr/bin/env node
// Builds the player downloads: one zip per OS with the dashboard, its own Node, the extractor
// (from the sibling stellaris-data-extraction repo, as committed) and, on Windows, Python.
// Linux uses the system's python3. Runtimes are pinned and checked against their published
// SHA-256 (nodejs.org SHASUMS256.txt, python.org's release API).
//
//   node scripts/package.mjs [--os windows|linux] [--extraction <repo>]   → dist/*.zip
//
// A release build (clean `main`, see RELEASE.md) refuses an extractor that is not on a tag.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	appendFileSync,
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoratedVersion } from './version.mjs';

const NODE = '24.22.0';
const NODE_SHA256 = {
	windows: 'f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3', // win-x64.zip
	linux: 'cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008' // linux-x64.tar.xz
};
const PYTHON = '3.14.8';
const PYTHON_SHA256 = 'a93abe456ab01bd96d7a085b3cdb6566b3063f4241360d114142fbdb07f0a310'; // embed-amd64.zip
/** packages whose code ends up in the build; their licences (and their dependencies') ship along */
const BUNDLED = ['jomini', 'uplot', 'svelte', '@sveltejs/kit', '@sveltejs/adapter-node'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : undefined;
};
const run = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });

const version = decoratedVersion();
const release = !version.includes('-');
const targets = arg('os') ? [arg('os')] : ['windows', 'linux'];
const extraction = resolve(root, arg('extraction') ?? '../stellaris-data-extraction');
const cache = join(root, '.cache');
const dist = join(root, 'dist');
const name = `stellaris-empire-dashboard-${version}`;

function extractorVersion() {
	const git = (...a) => run('git', ['-C', extraction, ...a]).trim();
	try {
		return git('describe', '--tags', '--exact-match', 'HEAD');
	} catch {
		if (release) throw new Error(`release build: ${extraction} is not on a tag`);
		return git('describe', '--tags', '--always', '--dirty');
	}
}

async function download(url, sha256, file) {
	const path = join(cache, file);
	if (!existsSync(path) || hash(path) !== sha256) {
		mkdirSync(cache, { recursive: true });
		console.log(`downloading ${url}`);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		writeFileSync(path, Buffer.from(await res.arrayBuffer()));
	}
	if (hash(path) !== sha256) throw new Error(`${file}: checksum mismatch`);
	return path;
}
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** The licence texts of the bundled packages and everything they depend on, once each. */
function notices() {
	const seen = new Map();
	const visit = (pkgName, from) => {
		let dir;
		try {
			dir = dirname(
				realpathSync(createRequire(join(from, 'x.js')).resolve(`${pkgName}/package.json`))
			);
		} catch {
			return; // types-only or optional
		}
		if (seen.has(dir)) return;
		const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
		const licence = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
		seen.set(
			dir,
			`${pkg.name} ${pkg.version} (${pkg.license ?? 'see text'})\n\n${licence ? readFileSync(join(dir, licence), 'utf8').trim() : '(no licence file)'}`
		);
		for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir);
	};
	for (const p of BUNDLED) visit(p, root);
	return [...seen.values()].sort().join(`\n\n${'='.repeat(78)}\n\n`);
}

function stageCommon(dir, extractorRef) {
	mkdirSync(join(dir, 'app', 'node_modules'), { recursive: true });
	cpSync(join(root, 'build'), join(dir, 'app'), { recursive: true });
	cpSync(
		realpathSync(join(root, 'node_modules', 'jomini')),
		join(dir, 'app', 'node_modules', 'jomini'),
		{
			recursive: true
		}
	);
	writeFileSync(
		join(dir, 'app', 'package.json'),
		JSON.stringify({ name: 'stellaris-empire-dashboard', version, type: 'module' }, null, '\t') +
			'\n'
	);

	mkdirSync(join(dir, 'extractor'));
	const tar = run(
		'git',
		[
			'-C',
			extraction,
			'archive',
			'--format=tar',
			'HEAD',
			'stellaris-extract.py',
			'extractor',
			'LICENSE'
		],
		{
			encoding: 'buffer'
		}
	);
	execFileSync('tar', ['-x', '-C', join(dir, 'extractor')], { input: tar });

	for (const f of ['launcher.mjs', 'README.txt']) cpSync(join(root, 'release', f), join(dir, f));
	cpSync(join(root, 'LICENSE'), join(dir, 'LICENSE'));
	writeFileSync(
		join(dir, 'THIRD-PARTY-NOTICES.txt'),
		`Bundled with the Stellaris Empire Dashboard.\nNode.js: node/LICENSE. The extractor: extractor/LICENSE.\n\n${notices()}\n`
	);
	writeFileSync(
		join(dir, 'VERSIONS.txt'),
		`dashboard ${version}\nextractor ${extractorRef}\nnode ${NODE}\n`
	);
}

async function stageWindows(dir) {
	const nodeZip = await download(
		`https://nodejs.org/dist/v${NODE}/node-v${NODE}-win-x64.zip`,
		NODE_SHA256.windows,
		`node-v${NODE}-win-x64.zip`
	);
	const tmp = join(cache, 'unpack-win');
	rmSync(tmp, { recursive: true, force: true });
	run('unzip', [
		'-q',
		nodeZip,
		`node-v${NODE}-win-x64/node.exe`,
		`node-v${NODE}-win-x64/LICENSE`,
		'-d',
		tmp
	]);
	cpSync(join(tmp, `node-v${NODE}-win-x64`), join(dir, 'node'), { recursive: true });

	const pyZip = await download(
		`https://www.python.org/ftp/python/${PYTHON}/python-${PYTHON}-embed-amd64.zip`,
		PYTHON_SHA256,
		`python-${PYTHON}-embed-amd64.zip`
	);
	run('unzip', ['-q', pyZip, '-d', join(dir, 'python')]);
	// The embeddable Python takes sys.path from its ._pth file only: add the extractor's folder.
	const pth = readdirSync(join(dir, 'python')).find((f) => f.endsWith('._pth'));
	if (!pth) throw new Error('no ._pth file in the embeddable Python');
	appendFileSync(join(dir, 'python', pth), '\r\n..\\extractor\r\n');
	appendFileSync(join(dir, 'VERSIONS.txt'), `python ${PYTHON}\n`);

	cpSync(join(root, 'release', 'start.bat'), join(dir, 'start.bat'));
	for (const f of ['start.bat', 'README.txt']) crlf(join(dir, f));
}

async function stageLinux(dir) {
	const tarball = await download(
		`https://nodejs.org/dist/v${NODE}/node-v${NODE}-linux-x64.tar.xz`,
		NODE_SHA256.linux,
		`node-v${NODE}-linux-x64.tar.xz`
	);
	const top = `node-v${NODE}-linux-x64`;
	mkdirSync(join(dir, 'node'));
	run('tar', [
		'-xJf',
		tarball,
		'-C',
		join(dir, 'node'),
		'--strip-components=1',
		`${top}/bin/node`,
		`${top}/LICENSE`
	]);
	cpSync(join(root, 'release', 'start.sh'), join(dir, 'start.sh'));
	chmodSync(join(dir, 'start.sh'), 0o755);
}

const crlf = (file) => writeFileSync(file, readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));

console.log(
	`packaging ${version} (${release ? 'release' : 'dev build'}) for ${targets.join(', ')}`
);
const extractorRef = extractorVersion();
run('pnpm', ['run', 'build'], { stdio: 'inherit' });
mkdirSync(dist, { recursive: true });
for (const os of targets) {
	if (!['windows', 'linux'].includes(os)) throw new Error(`unknown --os ${os}`);
	const stage = join(cache, `stage-${os}`);
	rmSync(stage, { recursive: true, force: true });
	const dir = join(stage, name);
	mkdirSync(dir, { recursive: true });
	stageCommon(dir, extractorRef);
	await (os === 'windows' ? stageWindows(dir) : stageLinux(dir));
	const zip = join(dist, `${name}-${os}-x64.zip`);
	rmSync(zip, { force: true });
	run('zip', ['-q', '-r', '-X', zip, name], { cwd: stage });
	console.log(`→ ${zip}`);
}
