import { DEFAULT_VIEW, parseView, type ColonyView } from './colonyTable.ts';
import { DEFAULT_CONTACT_VIEW, parseContactView, type ContactView } from './contacts.ts';
import { DEFAULT_EXPANSION_VIEW, parseExpansionView, type ExpansionView } from './expansion.ts';
import { parseChartEvents, parseTabs, type ChartEvents, type CustomTab } from './settings.ts';

// Profiles: named sets of viewer settings — one per playstyle or play-through. Everything but the
// theme (that is about the screen) belongs to a profile. The server keeps them (`setting` rows
// `profiles`, `profile:<id>`, `activeProfile`, `campaignProfiles`); a campaign remembers the
// profile last picked while playing it. Exported as a JSON file, imported as a new profile.

export const ROW_LINES = { thin: 1, medium: 2, thick: 4 } as const; // px
export type RowLine = keyof typeof ROW_LINES;
export type Display = {
	colonyRowLine: RowLine;
	expansionRowLine: RowLine;
	habitatsAlways: boolean; // habitat sites before habitats can be built (later behind cheats)
	anomalySpoilers: boolean; // situations tab: what an anomaly can turn into
	projectSpoilers: boolean; // situations tab: what a special project leads to
	contactStations: boolean; // first contact map: whose station each visited system has
	wholeGalaxy: boolean; // maps and megastructure sites: every system, not only the discovered
	unknownStars: boolean; // maps: the undiscovered systems too, without their hyperlanes
};
export const DEFAULT_DISPLAY: Display = {
	colonyRowLine: 'medium',
	expansionRowLine: 'medium',
	habitatsAlways: false,
	anomalySpoilers: false,
	projectSpoilers: false,
	contactStations: false,
	wholeGalaxy: false,
	unknownStars: false
};

export type ProfileSettings = {
	tabs: CustomTab[];
	chartEvents: ChartEvents;
	colonyView: ColonyView;
	expansionView: ExpansionView;
	contactView: ContactView;
	display: Display;
};
export type ProfileInfo = { id: string; name: string };

export const DEFAULT_SETTINGS: ProfileSettings = {
	tabs: [],
	chartEvents: {},
	colonyView: DEFAULT_VIEW,
	expansionView: DEFAULT_EXPANSION_VIEW,
	contactView: DEFAULT_CONTACT_VIEW,
	display: DEFAULT_DISPLAY
};

export function parseDisplay(v: unknown): Display {
	const o = (v ?? {}) as Partial<Display>;
	const line = (k: 'colonyRowLine' | 'expansionRowLine') => {
		const l = o[k];
		return l && l in ROW_LINES ? l : DEFAULT_DISPLAY[k];
	};
	return {
		colonyRowLine: line('colonyRowLine'),
		expansionRowLine: line('expansionRowLine'),
		habitatsAlways: o.habitatsAlways === true,
		anomalySpoilers: o.anomalySpoilers === true,
		projectSpoilers: o.projectSpoilers === true,
		contactStations: o.contactStations === true,
		wholeGalaxy: o.wholeGalaxy === true,
		unknownStars: o.unknownStars === true
	};
}

/** A stored or imported profile in the current shape; broken parts fall back to the defaults. */
export function parseSettings(v: unknown): ProfileSettings {
	const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
	return {
		tabs: parseTabs(o.tabs) ?? [],
		chartEvents: parseChartEvents(o.chartEvents) ?? {},
		colonyView: parseView(o.colonyView),
		expansionView: parseExpansionView(o.expansionView),
		contactView: parseContactView(o.contactView),
		display: parseDisplay(o.display)
	};
}

/** The known profiles, if `v` is a well-formed list. */
export function parseProfiles(v: unknown): ProfileInfo[] | null {
	if (!Array.isArray(v)) return null;
	const out = v.filter(
		(p): p is ProfileInfo => typeof p?.id === 'string' && typeof p?.name === 'string'
	);
	return out.length ? out : null;
}

/** The profile in use: the campaign's own, else the last picked, else the first. */
export function activeId(
	profiles: ProfileInfo[],
	active: unknown,
	byCampaign: Record<string, string>,
	campaign: string | null
): string {
	const known = (id: unknown): id is string => profiles.some((p) => p.id === id);
	const own = campaign === null ? undefined : byCampaign[campaign];
	return known(own) ? own : known(active) ? active : profiles[0].id;
}

/** "Wide", or "Wide (2)" … when the name is taken. */
export function uniqueName(name: string, taken: string[]): string {
	const base = name.trim().slice(0, 40) || 'profile';
	if (!taken.includes(base)) return base;
	for (let n = 2; ; n++) if (!taken.includes(`${base} (${n})`)) return `${base} (${n})`;
}

const FORMAT = 'stellaris-dashboard-profile';

export const exportFile = (name: string, settings: ProfileSettings) => ({
	format: FORMAT,
	version: 1,
	name,
	settings
});

/** An exported profile's name and settings; null when `v` is no such file. */
export function importFile(v: unknown): { name: string; settings: ProfileSettings } | null {
	const o = v as { format?: unknown; name?: unknown; settings?: unknown } | null;
	if (o?.format !== FORMAT || typeof o.name !== 'string') return null;
	return { name: o.name, settings: parseSettings(o.settings) };
}
