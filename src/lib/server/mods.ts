import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
	loadOrder,
	parseModDescriptor,
	withLauncher,
	type LauncherMod,
	type Playset
} from '#lib/addons.ts';
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
 * The active playset's enabled mods in load order: `<user dir>/dlc_load.json`, which the launcher
 * writes from the playset's order (checked 2026-10-31: the same as `playsets_mods.position`) at a
 * game start and on every playset edit (2026-11-09) — so not necessarily the last game's order.
 * None when missing or unreadable.
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
 * The English localisation of mods, in load order (`roots`: their folders):
 * `<mod>/localisation/english/` and its `replace/`, `*.yml`. A mod without a folder on disk (an
 * older one that comes as a zip too) is left out.
 */
export function loadModLocalisation(roots: string[]): Record<string, string> {
	const files: Record<string, string>[] = [];
	for (const root of roots) {
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

/** What mods add beside the data DB (`withModContent()`). */
export type ModContent = { text: Record<string, string>; techs: GameData['techs'] };

/**
 * What a campaign's mods add (`withModContent()`; `roots`: their folders in load order, the set
 * its game data is extracted with): their texts and their techs, costs resolved against the
 * game's scripted variables (`gameDir`, when known) and the mods' own.
 */
export function loadModContent(
	roots: string[],
	gameDir: string | undefined,
	jomini: Jomini
): ModContent {
	const text = loadModLocalisation(roots);
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

/**
 * The launcher's playsets (`launcher-v2.sqlite`), each with its enabled mods' descriptor files in
 * load order (`playsets_mods.position`), read-only; none if the DB is missing or unreadable. Read
 * when asked: an edit in the launcher counts at once, before the game starts with it.
 */
export function launcherPlaysets(userDir: string): Playset[] {
	const file = join(userDir, 'launcher-v2.sqlite');
	try {
		const db = new DatabaseSync(file, { readOnly: true });
		try {
			const rows = db
				.prepare(
					`SELECT p.id, p.name, p.isActive AS active, m.gameRegistryId AS file
					FROM playsets p
					LEFT JOIN playsets_mods pm ON pm.playsetId = p.id AND pm.enabled
					LEFT JOIN mods m ON m.id = pm.modId
					WHERE NOT p.isRemoved
					ORDER BY p.id, pm.position`
				)
				.all() as { id: string; name: string; active: number | null; file: string | null }[];
			const byId = new Map<string, Playset>();
			for (const r of rows) {
				let p = byId.get(r.id);
				if (!p) byId.set(r.id, (p = { name: r.name, active: !!r.active, order: [] }));
				if (r.file) p.order.push(r.file.replace(/^mod\//, ''));
			}
			return [...byId.values()];
		} finally {
			db.close();
		}
	} catch (e) {
		console.warn(`cannot read the launcher's playsets (${file}):`, e);
		return [];
	}
}
