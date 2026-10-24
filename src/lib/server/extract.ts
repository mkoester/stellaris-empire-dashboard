import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gameVersion } from './locate.ts';

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
 * `v4.5.2` plus a short hash of the installed DLC folders and the extractor's version: a new DLC
 * is new data too, and a dashboard update may need tables an older extractor did not write.
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

export const dataDbFile = (appDir: string, key: string) =>
	join(appDir, 'data', `stellaris-${key}.sqlite`);

/** The data DB for this install, extracting it first when there is none yet. */
export async function ensureDataDb(
	gameDir: string,
	appDir: string,
	extractor: Extractor | null,
	log: (line: string) => void = console.log
): Promise<string> {
	const version = gameVersion(gameDir);
	if (!version) throw new Error(`no launcher-settings.json with a game version in ${gameDir}`);
	let dlcs: string[] = [];
	try {
		dlcs = readdirSync(join(gameDir, 'dlc'));
	} catch {
		// no DLC folder: base game only
	}
	const file = dataDbFile(
		appDir,
		dataKey(version, dlcs, extractor && extractorVersion(extractor.script))
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
