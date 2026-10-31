import type { Dlc, ModInfo, ModVersionSeen } from './types.ts';

// DLCs and mods: the catalogue (data DB, mod descriptors) against what a save has active.
// Their changelog is the `dlc` and `mod` milestones (#lib/milestones.ts).

/** The DLC categories of the game's DLC descriptors, in the order the dlc tab groups them. */
export const DLC_CATEGORIES = [
	{ key: 'expansion', label: 'major expansions' },
	{ key: 'story_pack', label: 'story packs' },
	{ key: 'species_pack', label: 'species packs' },
	{ key: 'content_pack', label: 'content and portrait packs' },
	{ key: null, label: 'other (not installed)' }
] as const;

export type DlcRow = Dlc & { active: boolean | null }; // null: no save says

/**
 * Every known DLC with whether `active` (the save's `required_dlcs`) has it; a DLC the save
 * names but the data DB does not know (a newer game) is added at the end.
 */
export function dlcRows(catalogue: Dlc[], active: string[] | null): DlcRow[] {
	const known = new Set(catalogue.map((d) => d.name));
	const unknown = (active ?? []).filter((n) => !known.has(n));
	return [
		...catalogue.map((d) => ({ ...d, active: active ? active.includes(d.name) : null })),
		...unknown.map((name) => ({
			name,
			key: '',
			category: null,
			releaseDate: null,
			gameplay: true,
			baseGame: false,
			active: true
		}))
	];
}

export type ModRow = ModInfo & {
	active: boolean | null;
	supported: boolean | null;
	order: number | null; // place in the launcher's load order (1 = first), null: not enabled there
};

/** Days from an ISO time to `now` (ms); null when unknown. */
export const ageDays = (iso: string | null, now: number): number | null =>
	iso === null ? null : Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));

/** An age in days, short: "5 d", "3 mo", "2.5 y". */
export function ageLabel(days: number): string {
	if (days < 60) return `${days} d`;
	if (days < 730) return `${Math.round(days / 30.44)} mo`;
	return `${Math.round(days / 36.525) / 10} y`;
}

/** `dlc_load.json`'s `enabled_mods` as descriptor file names (`mod/ugc_1.mod` → `ugc_1.mod`). */
export function loadOrder(json: string): string[] {
	try {
		const mods = JSON.parse(json)?.enabled_mods;
		return Array.isArray(mods)
			? mods.filter((m) => typeof m === 'string').map((m: string) => m.replace(/^mod\//, ''))
			: [];
	} catch {
		return [];
	}
}

/**
 * Every installed mod (descriptor) with whether the save has it active and whether it claims to
 * support `gameVersion`; an active mod without a descriptor is listed by name.
 */
export function modRows(
	descriptors: ModInfo[],
	active: string[] | null,
	gameVersion: string | null,
	order: string[] = []
): ModRow[] {
	const place = new Map(order.map((f, i) => [f, i + 1]));
	const known = new Set(descriptors.map((m) => m.name));
	const missing = (active ?? []).filter((n) => !known.has(n));
	return [
		...descriptors,
		...missing.map((name) => ({
			name,
			version: null,
			supportedVersion: null,
			tags: [],
			steamId: null,
			updated: null,
			file: null,
			local: false
		}))
	].map((m) => ({
		...m,
		active: active ? active.includes(m.name) : null,
		supported: supports(m.supportedVersion, gameVersion),
		order: (m.file && place.get(m.file)) || null
	}));
}

/**
 * Does a descriptor's `supported_version` ("v4.5.*", "4.5.2", "*") cover the game version
 * ("Cygnus v4.5.2")? Compared part by part, `*` matching the rest; null when either is unknown.
 */
export function supports(supported: string | null, gameVersion: string | null): boolean | null {
	const game = gameVersion?.match(/(\d+(?:\.\d+)*)/)?.[1];
	if (!supported || !game) return null;
	const want = supported.trim().replace(/^v/, '').split('.');
	const have = game.split('.');
	for (const [i, part] of want.entries()) {
		if (part === '*') return true;
		if (part !== (have[i] ?? '0')) return false;
	}
	return true;
}

/**
 * A `mod/*.mod` descriptor: `key="value"` lines and a `tags={ "…" }` block. A dev copy registered
 * next to its published version (`link-mod.sh`) has the same name and workshop id, so the
 * file name is what tells the two apart.
 */
export function parseModDescriptor(text: string, file: string): ModInfo | null {
	const value = (key: string) => text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];
	const name = value('name');
	if (!name) return null;
	const tags = text.match(/^\s*tags\s*=\s*\{([^}]*)\}/m)?.[1];
	return {
		name,
		version: value('version') ?? null,
		supportedVersion: value('supported_version') ?? null,
		tags: tags ? [...tags.matchAll(/"([^"]*)"/g)].map((m) => m[1]) : [],
		steamId: value('remote_file_id') ?? null,
		updated: null,
		file,
		local: !/^ugc_\d+\.mod$/.test(file)
	};
}

/** The launcher's own record of a workshop mod (`launcher-v2.sqlite`, table `mods`). */
export type LauncherMod = { steamId: string; version: string | null; timeUpdated: number | null };

/** Descriptors completed from the launcher: its version where theirs has none, the update time. */
export function withLauncher(descriptors: ModInfo[], launcher: LauncherMod[]): ModInfo[] {
	const bySteam = new Map(launcher.map((l) => [l.steamId, l]));
	return descriptors.map((m) => {
		const l = m.steamId ? bySteam.get(m.steamId) : undefined;
		return {
			...m,
			version: m.version ?? (l?.version || null),
			updated: l?.timeUpdated ? new Date(l.timeUpdated * 1000).toISOString() : null
		};
	});
}

/**
 * The mods whose versions are noted: a local copy of a mod that also has a workshop descriptor is
 * left out, or the two would take turns as the mod's "latest" version at every start.
 */
export function trackedMods(mods: ModInfo[]): ModInfo[] {
	const workshop = new Set(mods.filter((m) => !m.local).map((m) => m.name));
	return mods.filter((m) => !m.local || !workshop.has(m.name));
}

export type ModVersionChange = {
	name: string;
	from: ModVersionSeen;
	to: ModVersionSeen;
};

/** Updates between consecutive sightings of each mod (a first sighting is no change), newest first. */
export function versionChanges(seen: ModVersionSeen[]): ModVersionChange[] {
	const last = new Map<string, ModVersionSeen>();
	const out: ModVersionChange[] = [];
	for (const s of [...seen].sort((a, b) => a.seenAt.localeCompare(b.seenAt))) {
		const prev = last.get(s.name);
		if (
			prev &&
			(prev.version !== s.version ||
				prev.supportedVersion !== s.supportedVersion ||
				prev.updated !== s.updated)
		)
			out.push({ name: s.name, from: prev, to: s });
		last.set(s.name, s);
	}
	return out.reverse();
}
