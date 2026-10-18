import type { ColonyView } from '#lib/colonyTable.ts';
import type { ContactView } from '#lib/contacts.ts';
import type { ExpansionView } from '#lib/expansion.ts';
import type { MapFilter } from '#lib/mapLayers.ts';
import type { MegaView } from '#lib/megastructures.ts';
import {
	activeId,
	parseProfiles,
	parseSettings,
	uniqueName,
	type Display,
	type ProfileInfo,
	type ProfileSettings
} from '#lib/profiles.ts';
import { parseTheme, type ChartEvents, type CustomTab, type Theme } from '#lib/settings.ts';
import { getDb } from './app.ts';
import { getSetting, headCampaign, setSetting, type Db } from './db.ts';

// The stored viewer settings. The theme is global; everything else lives in the profile in use
// (#lib/profiles.ts): the current campaign's, else the last picked.

export const theme = (): Theme => parseTheme(getSetting(getDb(), 'theme')) ?? 'system';

/**
 * The profiles, creating the first one (`default`) from the settings stored before profiles
 * existed — those rows stay, unread.
 */
export function profiles(db: Db): ProfileInfo[] {
	const known = parseProfiles(getSetting(db, 'profiles'));
	if (known) return known;
	const first = { id: 'default', name: 'default' };
	setSetting(
		db,
		`profile:${first.id}`,
		parseSettings({
			tabs: getSetting(db, 'tabs'),
			chartEvents: getSetting(db, 'chartEvents'),
			colonyView: getSetting(db, 'colonyView')
		})
	);
	setSetting(db, 'profiles', [first]);
	return [first];
}

const byCampaign = (db: Db) => (getSetting(db, 'campaignProfiles') ?? {}) as Record<string, string>;

/** The profile in use and its settings. */
export function activeProfile(db: Db): ProfileInfo & { settings: ProfileSettings } {
	const all = profiles(db);
	const id = activeId(all, getSetting(db, 'activeProfile'), byCampaign(db), headCampaign(db));
	return {
		...all.find((p) => p.id === id)!,
		settings: parseSettings(getSetting(db, `profile:${id}`))
	};
}

/** Changes the profile in use; `chartEvents` entries are merged into its map. */
export function updateProfile(db: Db, patch: Partial<ProfileSettings>) {
	const p = activeProfile(db);
	setSetting(db, `profile:${p.id}`, {
		...p.settings,
		...patch,
		chartEvents: { ...p.settings.chartEvents, ...(patch.chartEvents ?? {}) }
	});
}

export type ProfileAction =
	| { action: 'create'; name: string; copyOf?: string }
	| { action: 'rename'; id: string; name: string }
	| { action: 'delete'; id: string }
	| { action: 'select'; id: string }
	| { action: 'import'; name: string; settings: ProfileSettings };

/** Creates, renames, deletes, picks or imports a profile; returns the id it acted on. */
export function profileAction(db: Db, a: ProfileAction): string | null {
	const all = profiles(db);
	const others = (id: string) => all.filter((p) => p.id !== id).map((p) => p.name);
	switch (a.action) {
		case 'create':
		case 'import': {
			const id = crypto.randomUUID().slice(0, 8);
			const settings =
				a.action === 'import'
					? a.settings
					: parseSettings(a.copyOf ? getSetting(db, `profile:${a.copyOf}`) : undefined);
			setSetting(db, `profile:${id}`, settings);
			setSetting(db, 'profiles', [...all, { id, name: uniqueName(a.name, others(id)) }]);
			return id;
		}
		case 'rename':
			if (!all.some((p) => p.id === a.id)) return null;
			setSetting(
				db,
				'profiles',
				all.map((p) => (p.id === a.id ? { ...p, name: uniqueName(a.name, others(a.id)) } : p))
			);
			return a.id;
		case 'delete':
			// the last one stays; campaigns that used it fall back to the last picked
			if (all.length < 2 || !all.some((p) => p.id === a.id)) return null;
			setSetting(
				db,
				'profiles',
				all.filter((p) => p.id !== a.id)
			);
			setSetting(db, `profile:${a.id}`, null);
			return a.id;
		case 'select': {
			if (!all.some((p) => p.id === a.id)) return null;
			setSetting(db, 'activeProfile', a.id);
			const campaign = headCampaign(db);
			if (campaign !== null)
				setSetting(db, 'campaignProfiles', { ...byCampaign(db), [campaign]: a.id });
			return a.id;
		}
	}
}

/** Which campaigns use each profile, for the config tab. */
export const campaignsOf = (db: Db): Record<string, string[]> => {
	const out: Record<string, string[]> = {};
	for (const [campaign, id] of Object.entries(byCampaign(db))) (out[id] ??= []).push(campaign);
	return out;
};

const settings = () => activeProfile(getDb()).settings;
export const tabs = (): CustomTab[] => settings().tabs;
export const colonyView = (): ColonyView => settings().colonyView;
export const expansionView = (): ExpansionView => settings().expansionView;
export const contactView = (): ContactView => settings().contactView;
export const megastructureView = (): MegaView => settings().megastructureView;
export const mapFilter = (): MapFilter => settings().mapFilter;
export const display = (): Display => settings().display;
// Colony charts were stored as `planet:<title>` before the rename.
export const chartEvents = (): ChartEvents =>
	Object.fromEntries(
		Object.entries(settings().chartEvents).map(([k, v]) => [k.replace(/^planet:/, 'colony:'), v])
	);
