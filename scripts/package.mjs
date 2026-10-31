#!/usr/bin/env node
// Builds the player downloads: one zip per OS and architecture with the dashboard, its own Node,
// the extractor (from the sibling stellaris-data-extraction repo, as committed) and, on Windows
// and macOS, Python. Linux uses the system's python3; a Mac has none recent enough (only Apple's
// 3.9 with the Command Line Tools). Runtimes are pinned and checked against their published
// SHA-256 (nodejs.org SHASUMS256.txt, python.org's release API, python-build-standalone's
// GitHub release assets).
//
//   node scripts/package.mjs [--os windows|linux|macos] [--extraction <repo>]   → dist/*.zip
//
// A release build (clean `main`, or a `v<version>-rc.<n>` / `-beta.<n>` tag, see RELEASE.md)
// refuses an extractor that is not on the pinned tag.
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
	'windows-x64': 'f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3', // win-x64.zip
	'linux-x64': 'cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008', // linux-x64.tar.xz
	'macos-arm64': '75ddfb875bbd868ebe57536f4442225f54dd10f6d2178dd439de869a5c648dc3', // darwin-arm64.tar.xz
	'macos-x64': 'b890d687983ddc811641f6739c3ce99d2912c58f9e44b68aa25944037b425305' // darwin-x64.tar.xz
};
const PYTHON = '3.14.8';
const PYTHON_SHA256 = 'a93abe456ab01bd96d7a085b3cdb6566b3063f4241360d114142fbdb07f0a310'; // embed-amd64.zip
// macOS: python-build-standalone's relocatable CPython, the same version as Windows'
const PBS_RELEASE = '20261013';
const PBS_SHA256 = {
	'macos-arm64': '994adadc202c5df0b4570192cc9a70e3f2c131e512f4a125c56efa8562f44b28', // aarch64-apple-darwin
	'macos-x64': 'f0137337ecf6234b30c9c955219dae2d71e1a00387c4d204d6c6929e24bf9a90' // x86_64-apple-darwin
};
const PBS_ARCH = { 'macos-arm64': 'aarch64', 'macos-x64': 'x86_64' };
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
// a release or a prerelease (`-rc.<n>`, `-beta.<n>`): each bundles exactly the pinned extractor
const release = /^\d+\.\d+\.\d+(-(rc|beta)\.\d+)?$/.test(version);
/** `--os macos` builds both Mac architectures */
const TARGETS = ['windows-x64', 'linux-x64', 'macos-arm64', 'macos-x64'];
const targets = arg('os') ? TARGETS.filter((t) => t.startsWith(`${arg('os')}-`)) : TARGETS;
if (!targets.length) throw new Error(`unknown --os ${arg('os')}`);
const extraction = resolve(root, arg('extraction') ?? '../stellaris-data-extraction');
const cache = join(root, '.cache');
const dist = join(root, 'dist');
const name = `stellaris-empire-dashboard-${version}`;

/** The extractor's tag; a release bundles exactly the one package.json pins (`extractorVersion`). */
function extractorVersion() {
	const git = (...a) => run('git', ['-C', extraction, ...a]).trim();
	const pinned = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).extractorVersion;
	const tags = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean);
	if (release && !tags.includes(pinned))
		throw new Error(
			`release build: ${extraction} must be on ${pinned} (package.json extractorVersion), is on ${tags.join(', ') || 'no tag'}`
		);
	return tags.includes(pinned) ? pinned : git('describe', '--tags', '--always', '--dirty');
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
		NODE_SHA256['windows-x64'],
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

/** Node's `bin/node` and licence from the nodejs.org tarball for `platform` (`linux-x64`, …). */
async function stageNodeTarball(dir, platform, sha256) {
	const tarball = await download(
		`https://nodejs.org/dist/v${NODE}/node-v${NODE}-${platform}.tar.xz`,
		sha256,
		`node-v${NODE}-${platform}.tar.xz`
	);
	const top = `node-v${NODE}-${platform}`;
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
}

async function stageLinux(dir) {
	await stageNodeTarball(dir, 'linux-x64', NODE_SHA256['linux-x64']);
	cpSync(join(root, 'release', 'start.sh'), join(dir, 'start.sh'));
	chmodSync(join(dir, 'start.sh'), 0o755);
}

async function stageMac(dir, target) {
	const arch = target.slice('macos-'.length);
	await stageNodeTarball(dir, `darwin-${arch}`, NODE_SHA256[target]);
	const file = `cpython-${PYTHON}+${PBS_RELEASE}-${PBS_ARCH[target]}-apple-darwin-install_only_stripped.tar.gz`;
	const tarball = await download(
		`https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}/${encodeURIComponent(file)}`,
		PBS_SHA256[target],
		file
	);
	run('tar', ['-xzf', tarball, '-C', dir]); // → python/bin/python3, python/lib/…
	// The extractor needs the interpreter and the standard library only (sqlite3, json, re: built
	// into the static bin/python3.14). What embeds, builds or installs Python, and Tk, stays out.
	const minor = PYTHON.split('.').slice(0, 2).join('.');
	const lib = `lib/python${minor}`;
	const unused = [
		'include',
		'share',
		...['idle3', 'pip', 'pip3', 'pydoc3', 'python3-config']
			.flatMap((f) => [f, f.replace('3', minor)])
			.map((f) => `bin/${f}`),
		// libpython (for embedding) and Tcl/Tk
		...readdirSync(join(dir, 'python', 'lib'))
			.filter((f) => f !== `python${minor}`)
			.map((f) => `lib/${f}`),
		...['site-packages', 'ensurepip', 'idlelib', 'tkinter', 'turtledemo', 'test', 'lib-dynload']
			.concat(`config-${minor}-darwin`)
			.map((f) => `${lib}/${f}`)
	];
	for (const f of unused) rmSync(join(dir, 'python', f), { recursive: true, force: true });
	appendFileSync(
		join(dir, 'VERSIONS.txt'),
		`python ${PYTHON} (python-build-standalone ${PBS_RELEASE})\n`
	);
	cpSync(join(root, 'release', 'start.command'), join(dir, 'start.command'));
	chmodSync(join(dir, 'start.command'), 0o755);
}

const crlf = (file) => writeFileSync(file, readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));

console.log(
	`packaging ${version} (${release ? 'release' : 'dev build'}) for ${targets.join(', ')}`
);
const extractorRef = extractorVersion();
run('pnpm', ['run', 'build'], { stdio: 'inherit' });
mkdirSync(dist, { recursive: true });
for (const target of targets) {
	const stage = join(cache, `stage-${target}`);
	rmSync(stage, { recursive: true, force: true });
	const dir = join(stage, name);
	mkdirSync(dir, { recursive: true });
	stageCommon(dir, extractorRef);
	if (target === 'windows-x64') await stageWindows(dir);
	else if (target === 'linux-x64') await stageLinux(dir);
	else await stageMac(dir, target);
	const zip = join(dist, `${name}-${target}.zip`);
	rmSync(zip, { force: true });
	// -y: symlinks as symlinks (macOS's python3 → python3.14), not as copies
	run('zip', ['-q', '-r', '-X', '-y', zip, name], { cwd: stage });
	console.log(`→ ${zip}`);
}
