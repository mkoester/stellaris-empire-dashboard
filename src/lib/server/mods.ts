import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseModDescriptor, withLauncher, type LauncherMod } from '#lib/addons.ts';
import type { ModInfo } from '#lib/types.ts';

/**
 * The installed mods: `<Stellaris user dir>/mod/*.mod` descriptors, the user dir being the save
 * folder's parent, completed from the launcher's `launcher-v2.sqlite` (update time, version).
 * Missing folder (a save folder copied elsewhere): none, the mods tab then shows the save's names.
 */
export function loadModDescriptors(saveDir: string): ModInfo[] {
	const userDir = dirname(saveDir);
	const dir = join(userDir, 'mod');
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith('.mod'));
	} catch {
		console.warn(`no mod descriptors in ${dir}`);
		return [];
	}
	const descriptors = files
		.sort()
		.map((f) => parseModDescriptor(readFileSync(join(dir, f), 'utf8')))
		.filter((m) => m !== null);
	return withLauncher(descriptors, launcherMods(join(userDir, 'launcher-v2.sqlite')));
}

/** The launcher's workshop mods, read-only; none if its DB is missing or unreadable. */
function launcherMods(file: string): LauncherMod[] {
	try {
		const db = new DatabaseSync(file, { readOnly: true });
		try {
			return db
				.prepare('SELECT steamId, version, timeUpdated FROM mods WHERE steamId IS NOT NULL')
				.all() as LauncherMod[];
		} finally {
			db.close();
		}
	} catch (e) {
		console.warn(`cannot read the launcher's mods (${file}):`, e);
		return [];
	}
}
