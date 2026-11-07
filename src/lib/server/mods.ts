import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadOrder, parseModDescriptor, withLauncher, type LauncherMod } from '#lib/addons.ts';
import { Jomini } from 'jomini';
import { mergeLocalisation, parseLocalisation } from '#lib/localisation.ts';
import { modTechs, scriptedVariables } from '#lib/modContent.ts';
import type { GameData, ModInfo } from '#lib/types.ts';

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
		.map((f) => parseModDescriptor(readFileSync(join(dir, f), 'utf8'), f))
		.filter((m) => m !== null);
	return withLauncher(descriptors, launcherMods(join(userDir, 'launcher-v2.sqlite')));
}

/**
 * The enabled mods in the order the game loads them: `<user dir>/dlc_load.json`, which the
 * launcher writes from the active playset's order when it starts the game (checked 2026-10-31:
 * the same order as `playsets_mods.position`). None when missing or unreadable.
 */
export function readLoadOrder(userDir: string): string[] {
	try {
		return loadOrder(readFileSync(join(userDir, 'dlc_load.json'), 'utf8'));
	} catch {
		return [];
	}
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

/**
 * The English localisation of the enabled mods, in load order (`enabled` holds descriptor file
 * names, `readLoadOrder()`): `<mod>/localisation/english/` and its `replace/`, `*.yml`. A mod
 * without a folder on disk is left out.
 */
export function loadModLocalisation(
	mods: ModInfo[],
	enabled: string[],
	userDir: string
): Record<string, string> {
	const files: Record<string, string>[] = [];
	for (const root of modRoots(mods, enabled, userDir)) {
		for (const dir of [
			join(root, 'localisation', 'english'),
			join(root, 'localisation', 'english', 'replace')
		]) {
			let names: string[];
			try {
				names = readdirSync(dir).filter((f) => f.endsWith('.yml'));
			} catch {
				continue;
			}
			for (const name of names.sort())
				files.push(parseLocalisation(readFileSync(join(dir, name), 'utf8')));
		}
	}
	return mergeLocalisation(files);
}

/** The enabled mods' folders, in load order. */
function modRoots(mods: ModInfo[], enabled: string[], userDir: string): string[] {
	const byFile = new Map(mods.map((m) => [m.file, m]));
	return enabled.flatMap((file) => {
		const path = byFile.get(file)?.path;
		return path ? [isAbsolute(path) ? path : join(userDir, path)] : [];
	});
}

/** A folder's `*.txt` files, sorted; none if it is missing. */
function scripts(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((f) => f.endsWith('.txt'))
			.sort()
			.map((f) => readFileSync(join(dir, f), 'utf8'));
	} catch {
		return [];
	}
}

/**
 * What the enabled mods add (`withModContent()`): their texts and their techs, costs resolved
 * against the game's scripted variables (`gameDir`, when known) and the mods' own.
 */
export async function loadModContent(
	mods: ModInfo[],
	enabled: string[],
	userDir: string,
	gameDir: string | undefined
): Promise<{ text: Record<string, string>; techs: GameData['techs'] }> {
	const text = loadModLocalisation(mods, enabled, userDir);
	const roots = modRoots(mods, enabled, userDir);
	const techFiles = roots.flatMap((r) => scripts(join(r, 'common', 'technology')));
	if (!techFiles.length) return { text, techs: {} };
	const vars = Object.assign(
		{},
		...[
			...(gameDir ? scripts(join(gameDir, 'common', 'scripted_variables')) : []),
			...roots.flatMap((r) => scripts(join(r, 'common', 'scripted_variables'))),
			...techFiles
		].map(scriptedVariables)
	);
	const jomini = await Jomini.initialize();
	const techs: GameData['techs'] = {};
	for (const file of techFiles) {
		try {
			Object.assign(
				techs,
				modTechs(jomini.parseText(file, { typeNarrowing: 'unquoted' }), vars, text)
			);
		} catch (e) {
			console.warn('cannot read a mod tech file:', e);
		}
	}
	return { text, techs };
}
