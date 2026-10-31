import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, posix, win32 } from 'node:path';

// Finds the game's install and user folders on this machine for /setup. Guesses are cheap: a
// folder counts only if it holds what the game puts there (`isGameDir`, `isUserDir`), so a wrong
// candidate never shows. Not yet seen on a real machine, from community reports only: the
// Microsoft Store / Game Pass layout (`XboxGames\Stellaris\Content`), GOG's registry key and the
// Heroic/Lutris folders, and macOS (Steam's folder from the workspace notes; the user folder from
// the game's own `gameDataPath`, `%USER_DOCUMENTS%/Paradox Interactive/Stellaris`) — /setup's own
// fields are the fallback.

const STEAM_APP = '281990';
const PDX = 'Paradox Interactive';

/** Reads a registry value (Windows only); null where there is none. */
export type Registry = (key: string, args: string[]) => string | null;

export type Machine = {
	platform: string;
	home: string;
	env: Record<string, string | undefined>;
	reg: Registry;
};

export type GameCandidate = { dir: string; source: string; version: string | null };
export type UserCandidate = {
	dir: string;
	source: string;
	saves: number;
	newestSave: number | null;
};

/**
 * Valve's KeyValues text format (`libraryfolders.vdf`, `appmanifest_*.acf`): quoted keys and
 * values, `{ }` blocks, `//` comments. Duplicate keys: the last wins.
 */
export function parseVdf(text: string): Record<string, unknown> {
	const tokens = [...text.matchAll(/"((?:[^"\\]|\\.)*)"|([{}])|\/\/[^\n]*/g)]
		.filter((m) => m[1] !== undefined || m[2] !== undefined)
		.map((m) => (m[2] ?? { s: m[1].replace(/\\(.)/g, '$1') }) as '{' | '}' | { s: string });
	let i = 0;
	const block = (): Record<string, unknown> => {
		const out: Record<string, unknown> = {};
		while (i < tokens.length) {
			const t = tokens[i++];
			if (t === '}') return out;
			if (t === '{') continue; // stray brace
			const v = tokens[i++];
			if (v === undefined) break;
			out[t.s] = v === '{' ? block() : typeof v === 'object' ? v.s : '';
		}
		return out;
	};
	return block();
}

/** The library folders a `libraryfolders.vdf` lists. */
export function steamLibraries(vdf: Record<string, unknown>): string[] {
	const root = (vdf.libraryfolders ?? vdf.LibraryFolders) as Record<string, unknown> | undefined;
	if (!root) return [];
	return Object.values(root)
		.map((v) => (typeof v === 'string' ? v : (v as Record<string, unknown>)?.path))
		.filter((p): p is string => typeof p === 'string' && p !== '');
}

/** `reg query` output: one entry per value line (`    Name    REG_SZ    data`). */
export function parseRegQuery(out: string): { key: string; name: string; value: string }[] {
	const rows: { key: string; name: string; value: string }[] = [];
	let key = '';
	for (const line of out.split(/\r?\n/)) {
		if (/^HKEY_/.test(line)) key = line.trim();
		const m = /^\s+(.+?)\s+(REG_\w+)\s+(.*)$/.exec(line);
		if (m) rows.push({ key, name: m[1], value: m[3].trim() });
	}
	return rows;
}

/** `%USERPROFILE%`-style references, as in REG_EXPAND_SZ values. */
export const expandEnv = (s: string, env: Machine['env']) =>
	s.replace(/%([^%]+)%/g, (all, name: string) => {
		const hit = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase());
		return hit ? (env[hit] ?? all) : all;
	});

/** Steam's own folders, before reading their library lists. */
export function steamRoots(m: Machine): string[] {
	const p = m.platform === 'win32' ? win32 : posix;
	if (m.platform === 'win32') {
		const reg = m.reg('HKCU\\Software\\Valve\\Steam', ['/v', 'SteamPath']);
		const fromReg = reg ? parseRegQuery(reg).find((r) => r.name === 'SteamPath')?.value : undefined;
		return [
			...(fromReg ? [p.normalize(fromReg)] : []),
			p.join(m.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
			p.join(m.env.ProgramFiles || 'C:\\Program Files', 'Steam')
		];
	}
	if (m.platform === 'darwin') return [p.join(m.home, 'Library', 'Application Support', 'Steam')];
	const data = m.env.XDG_DATA_HOME || p.join(m.home, '.local', 'share');
	return [
		p.join(data, 'Steam'),
		p.join(m.home, '.steam', 'steam'),
		p.join(m.home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
		p.join(m.home, 'snap', 'steam', 'common', '.local', 'share', 'Steam')
	];
}

/** Every Steam library on this machine: the roots and what their `libraryfolders.vdf` lists. */
export function steamLibraryDirs(m: Machine, read = readText): string[] {
	const p = m.platform === 'win32' ? win32 : posix;
	const libs: string[] = [];
	for (const root of steamRoots(m)) {
		const vdf = read(p.join(root, 'steamapps', 'libraryfolders.vdf'));
		if (vdf === null) continue;
		libs.push(root, ...steamLibraries(parseVdf(vdf)).map((l) => p.normalize(l)));
	}
	return libs;
}

/** Where the game may be installed, in order of preference, with the store it comes from. */
export function gameDirGuesses(m: Machine, libraries: string[]): [string, string][] {
	const p = m.platform === 'win32' ? win32 : posix;
	const steam = libraries.map(
		(l) => [p.join(l, 'steamapps', 'common', 'Stellaris'), 'Steam'] as [string, string]
	);
	if (m.platform === 'win32') {
		const reg = m.reg('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', ['/s', '/v', 'path']);
		const gog = (reg ? parseRegQuery(reg) : [])
			.filter((r) => r.name === 'path' && /stellaris/i.test(r.value))
			.map((r) => [r.value, 'GOG'] as [string, string]);
		const drives = ['C', 'D', 'E', 'F', 'G', 'H'];
		return [
			...steam,
			...gog,
			['C:\\GOG Games\\Stellaris', 'GOG'],
			['C:\\Program Files (x86)\\GOG Galaxy\\Games\\Stellaris', 'GOG'],
			...drives.map(
				(d) => [`${d}:\\XboxGames\\Stellaris\\Content`, 'Microsoft Store'] as [string, string]
			)
		];
	}
	if (m.platform === 'darwin') return steam;
	return [
		...steam,
		[p.join(m.home, 'GOG Games', 'Stellaris', 'game'), 'GOG'],
		[p.join(m.home, 'GOG Games', 'Stellaris'), 'GOG'],
		[p.join(m.home, 'Games', 'Heroic', 'Stellaris'), 'GOG (Heroic)'],
		[p.join(m.home, 'Games', 'stellaris'), 'Lutris']
	];
}

/** The real Documents folder on Windows (it may be redirected, e.g. to OneDrive). */
function documentsDirs(m: Machine): string[] {
	const p = win32;
	const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';
	const reg = m.reg(key, ['/v', 'Personal']);
	const personal = reg ? parseRegQuery(reg).find((r) => r.name === 'Personal')?.value : undefined;
	return [
		...(personal ? [expandEnv(personal, m.env)] : []),
		p.join(m.home, 'Documents'),
		p.join(m.home, 'OneDrive', 'Documents')
	];
}

/** Where the game's user folder may be, with how the game was run. */
export function userDirGuesses(
	m: Machine,
	libraries: string[],
	list = listDir
): [string, string][] {
	const p = m.platform === 'win32' ? win32 : posix;
	// any `Stellaris*` folder next to the expected one (store builds name theirs differently)
	const stellarisIn = (dir: string, source: string) =>
		list(dir)
			.filter((n) => /^stellaris/i.test(n))
			.map((n) => [p.join(dir, n), source] as [string, string]);
	if (m.platform === 'win32')
		return documentsDirs(m).flatMap((d) => stellarisIn(p.join(d, PDX), 'Windows'));
	if (m.platform === 'darwin') return stellarisIn(p.join(m.home, 'Documents', PDX), 'macOS');

	const data = m.env.XDG_DATA_HOME || p.join(m.home, '.local', 'share');
	const docs = (prefix: string, user: string) =>
		p.join(prefix, 'drive_c', 'users', user, 'Documents', PDX, 'Stellaris');
	const prefixes = [
		...list(p.join(m.home, 'Games', 'Heroic', 'Prefixes')).map((n) =>
			p.join(m.home, 'Games', 'Heroic', 'Prefixes', n)
		),
		p.join(m.home, '.wine')
	];
	return [
		[p.join(data, PDX, 'Stellaris'), 'Linux native'],
		...libraries.map(
			(l) =>
				[docs(p.join(l, 'steamapps', 'compatdata', STEAM_APP, 'pfx'), 'steamuser'), 'Proton'] as [
					string,
					string
				]
		),
		...prefixes.flatMap((pre) =>
			list(p.join(pre, 'drive_c', 'users')).map((u) => [docs(pre, u), 'Wine'] as [string, string])
		)
	];
}

export const isGameDir = (dir: string) =>
	existsSync(join(dir, 'launcher-settings.json')) && isDir(join(dir, 'common'));

export const isUserDir = (dir: string) =>
	isDir(join(dir, 'save games')) || existsSync(join(dir, 'settings.txt'));

/** The game version a install folder names (`"v4.5.2"`), from its `launcher-settings.json`. */
export const gameVersion = (dir: string) => launcherSetting(dir, 'rawVersion');

/**
 * The game's build (`"7793"`), from `launcher-settings.json`'s `version` (`Cygnus v4.5.3 (7793)`):
 * an open beta and the release after it share their `rawVersion`, not their build.
 */
export const gameBuild = (dir: string) => buildOf(launcherSetting(dir, 'version'));

/** The build in a version string (`Cygnus v4.5.3 (7793)` → `7793`), null without one. Pure. */
export const buildOf = (version: string | null) => /\((\d+)\)\s*$/.exec(version ?? '')?.[1] ?? null;

function launcherSetting(dir: string, key: string): string | null {
	const text = readText(join(dir, 'launcher-settings.json'));
	if (text === null) return null;
	try {
		const v = JSON.parse(text)[key];
		return typeof v === 'string' ? v : null;
	} catch {
		return null;
	}
}

/** How many saves a user folder holds and when the newest was written (ms). */
export function saveStats(dir: string): { saves: number; newestSave: number | null } {
	let saves = 0;
	let newestSave: number | null = null;
	const root = join(dir, 'save games');
	for (const campaign of listDir(root)) {
		for (const f of listDir(join(root, campaign))) {
			if (!f.endsWith('.sav')) continue;
			saves++;
			const t = mtime(join(root, campaign, f));
			if (t !== null && (newestSave === null || t > newestSave)) newestSave = t;
		}
	}
	return { saves, newestSave };
}

/** The candidates that hold up, each folder once; user folders newest save first. */
export function discover(m: Machine = thisMachine()): {
	games: GameCandidate[];
	users: UserCandidate[];
} {
	const libraries = uniqueBy(
		m.platform,
		steamLibraryDirs(m).map((d) => [d, ''] as [string, string])
	).map(([d]) => d);
	const games = uniqueBy(
		m.platform,
		gameDirGuesses(m, libraries).filter(([d]) => isGameDir(d))
	).map(([dir, source]) => ({ dir, source, version: gameVersion(dir) }));
	const users = uniqueBy(
		m.platform,
		userDirGuesses(m, libraries).filter(([d]) => isUserDir(d))
	)
		.map(([dir, source]) => ({ dir, source, ...saveStats(dir) }))
		.sort((a, b) => (b.newestSave ?? -1) - (a.newestSave ?? -1));
	return { games, users };
}

export function thisMachine(): Machine {
	return {
		platform: process.platform,
		home: process.env.USERPROFILE || process.env.HOME || '',
		env: process.env,
		reg: (key, args) => {
			if (process.platform !== 'win32') return null;
			try {
				return execFileSync('reg', ['query', key, ...args], {
					encoding: 'utf8',
					windowsHide: true
				});
			} catch {
				return null; // no such key or value
			}
		}
	};
}

function readText(file: string): string | null {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return null;
	}
}

function listDir(dir: string): string[] {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function isDir(dir: string): boolean {
	try {
		return statSync(dir).isDirectory();
	} catch {
		return false;
	}
}

function mtime(file: string): number | null {
	try {
		return statSync(file).mtimeMs;
	} catch {
		return null;
	}
}

const real = (dir: string) => {
	try {
		return realpathSync(dir);
	} catch {
		return dir;
	}
};

/**
 * Which folder a path names: symlinks such as `~/.steam/steam` resolved, and on Windows and macOS
 * (case-insensitive file systems by default) case and separators folded — Steam keeps its registry
 * `SteamPath` lowercase (`c:/program files (x86)/steam`), its `libraryfolders.vdf` the real case.
 */
export function folderKey(platform: string, dir: string, resolve = real): string {
	if (platform === 'win32') return win32.normalize(resolve(dir)).toLowerCase();
	return platform === 'darwin' ? resolve(dir).toLowerCase() : resolve(dir);
}

/** The folder as it is spelled on disk (Windows: `realpathSync.native` returns the real case). */
function spelled(platform: string, dir: string): string {
	if (platform !== 'win32') return dir;
	try {
		return realpathSync.native(dir);
	} catch {
		return dir;
	}
}

/** First of each folder (`folderKey`), keeping the order, as spelled on disk. */
export function uniqueBy(
	platform: string,
	list: [string, string][],
	resolve = real
): [string, string][] {
	const seen = new Set<string>();
	return list
		.filter(([d]) => {
			const k = folderKey(platform, d, resolve);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		})
		.map(([d, source]) => [spelled(platform, d), source]);
}
