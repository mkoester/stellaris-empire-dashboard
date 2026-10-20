import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Where the dashboard keeps its own files, and which game folders it reads. Environment variables
// win (the dev setup in AGENTS.md), then `config.json` in the app data folder, written by /setup.

/** The two folders a player picks; everything else follows from them. */
export type Config = {
	/** the game's install folder (holds `launcher-settings.json`), read by the extraction */
	gameDir?: string;
	/** the game's user folder (holds `save games/`, `logs/`, `mod/`) */
	userDir?: string;
	/** opt-in: the companion mod's `game.log` */
	gameLog?: string;
};

export type Paths = {
	dashboardDb: string;
	saveDir: string;
	/** the extraction's SQLite; unset = extract from `gameDir` */
	dataDb?: string;
	gameDir?: string;
	gameLog?: string;
};

type Env = Record<string, string | undefined>;

export const APP = 'stellaris-empire-dashboard';

/** `%APPDATA%\<app>` on Windows, `$XDG_DATA_HOME/<app>` (default `~/.local/share`) elsewhere. */
export function appDataDir(platform: string, env: Env, home: string): string {
	if (platform === 'win32') return join(env.APPDATA || join(home, 'AppData', 'Roaming'), APP);
	return join(env.XDG_DATA_HOME || join(home, '.local', 'share'), APP);
}

export const saveDirOf = (userDir: string) => join(userDir, 'save games');

/** The paths to run with, or null while a folder is still missing (→ /setup). */
export function resolvePaths(env: Env, config: Config, appDir: string): Paths | null {
	const saveDir = env.STELLARIS_SAVE_DIR || (config.userDir && saveDirOf(config.userDir));
	const dataDb = env.STELLARIS_DATA_DB || undefined;
	const gameDir = env.STELLARIS_GAME_DIR || config.gameDir;
	if (!saveDir || (!dataDb && !gameDir)) return null;
	return {
		dashboardDb: env.DASHBOARD_DB || join(appDir, 'dashboard.sqlite'),
		saveDir,
		dataDb,
		gameDir,
		gameLog: env.STELLARIS_GAME_LOG || config.gameLog
	};
}

const configFile = (appDir: string) => join(appDir, 'config.json');

/** The stored config; empty when there is none or it does not parse. */
export function readConfig(appDir: string): Config {
	try {
		const c = JSON.parse(readFileSync(configFile(appDir), 'utf8'));
		return typeof c === 'object' && c !== null ? c : {};
	} catch {
		return {};
	}
}

export function writeConfig(appDir: string, config: Config) {
	mkdirSync(appDir, { recursive: true });
	const tmp = `${configFile(appDir)}.tmp`;
	writeFileSync(tmp, JSON.stringify(config, null, '\t') + '\n');
	renameSync(tmp, configFile(appDir));
}
