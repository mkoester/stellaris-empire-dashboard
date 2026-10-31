import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { gameBuild, gameVersion } from './locate.ts';

// The game data (names, costs, modifiers) comes from stellaris-data-extraction, run on this
// machine against the player's own install — once per game version and set of DLCs, ~5 s.
// The packaged dashboard ships the extractor and names it and its Python in the environment
// (`launcher.mjs`); a dev setup passes STELLARIS_DATA_DB instead and never extracts.

export type Extractor = { python: string; script: string };

export function extractorFromEnv(env: Record<string, string | undefined>): Extractor | null {
	const script = env.STELLARIS_EXTRACTOR;
	return script ? { python: env.STELLARIS_PYTHON || 'python3', script } : null;
}

/**
 * `v4.5.2` (with its build, `v4.5.3_7793`: an open beta and its release share the version) plus a
 * short hash of the installed DLC folders and the extractor (`extractorIdentity()`: its version and
 * sources): a new DLC is new data too, and a changed extractor may write tables or values the old
 * file lacks.
 */
export function dataKey(version: string, dlcs: string[], extractor: string | null = null): string {
	const hash = createHash('sha256')
		.update([...dlcs].sort().join('\n') + (extractor ? `\nextractor ${extractor}` : ''))
		.digest('hex')
		.slice(0, 8);
	return `${version.replace(/[^\w.-]/g, '_')}-${hash}`;
}

/** The extractor's `__version__` (`extractor/__init__.py` beside its script), null if unreadable. */
export function extractorVersion(script: string): string | null {
	try {
		const init = readFileSync(join(dirname(script), 'extractor', '__init__.py'), 'utf8');
		return /^__version__\s*=\s*['"]([^'"]+)['"]/m.exec(init)?.[1] ?? null;
	} catch {
		return null;
	}
}

/**
 * The extractor as the cache key sees it: its `__version__` plus a hash of its sources (the script
 * and every `.py` under `extractor/`), so a changed extractor extracts again — during development
 * its version stays the same across changes. Null if there is no `extractor/` beside the script.
 */
export function extractorIdentity(script: string): string | null {
	const version = extractorVersion(script);
	const pkg = join(dirname(script), 'extractor');
	let files: string[];
	try {
		files = readdirSync(pkg, { recursive: true, encoding: 'utf8' })
			.filter((f) => f.endsWith('.py'))
			.sort();
	} catch {
		return null;
	}
	const hash = createHash('sha256');
	for (const [name, file] of [
		['<script>', script],
		...files.map((f) => [f.split(sep).join('/'), join(pkg, f)])
	]) {
		hash.update(`${name}\0`);
		try {
			hash.update(readFileSync(file));
		} catch {
			// unreadable: its name alone
		}
		hash.update('\0');
	}
	return `${version ?? '?'}+${hash.digest('hex').slice(0, 12)}`;
}

export const dataDbFile = (appDir: string, key: string) =>
	join(appDir, 'data', `stellaris-${key}.sqlite`);

/** The data DB for this install, extracting it first when there is none yet. */
export async function ensureDataDb(
	gameDir: string,
	appDir: string,
	extractor: Extractor | null,
	log: (line: string) => void = console.log
): Promise<string> {
	const raw = gameVersion(gameDir);
	if (!raw) throw new Error(`no launcher-settings.json with a game version in ${gameDir}`);
	const build = gameBuild(gameDir);
	const version = build ? `${raw}_${build}` : raw;
	let dlcs: string[] = [];
	try {
		dlcs = readdirSync(join(gameDir, 'dlc'));
	} catch {
		// no DLC folder: base game only
	}
	const file = dataDbFile(
		appDir,
		dataKey(version, dlcs, extractor && extractorIdentity(extractor.script))
	);
	if (existsSync(file)) return file;
	if (!extractor)
		throw new Error(
			'no game data for this game version, and no extractor to make it (STELLARIS_EXTRACTOR)'
		);

	mkdirSync(join(appDir, 'data'), { recursive: true });
	const tmp = `${file}.tmp`;
	rmSync(tmp, { force: true });
	log(`extracting game data for ${version} from ${gameDir} …`);
	await run(extractor.python, [extractor.script, gameDir, '--sqlite', tmp]);
	renameSync(tmp, file);
	log(`game data ready: ${file}`);
	return file;
}

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
		let err = '';
		child.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
		child.on('error', (e) =>
			reject(
				(e as NodeJS.ErrnoException).code === 'ENOENT'
					? new Error(`${cmd} not found — the extraction needs Python 3.10 or newer`)
					: e
			)
		);
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`extraction failed (exit ${code}):\n${err}`))
		);
	});
}
