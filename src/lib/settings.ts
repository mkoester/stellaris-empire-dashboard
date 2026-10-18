import { KIND_IDS, type EventKind } from './milestones.ts';

// Viewer settings kept on the server (`setting` table), so every device sees the same: the theme,
// the custom tabs and which milestones each chart shows. Requests carry them as JSON; the parsers
// reject anything malformed.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** A tab of one's own: a name, whether the header shows on top, and the panels below, in order. */
export type CustomTab = { id: string; name: string; header: boolean; panels: PanelId[] };

/**
 * The empire panels, in the order the `all` tab shows them, grouped as it lays them out. A custom
 * tab picks from the same list; `wide` panels span the full width there.
 */
export const LAYOUT = [
	{
		cols: 'flex flex-col gap-2',
		panels: [
			{ id: 'header', label: 'Header: rank, date, progress', wide: true },
			{ id: 'resources', label: 'Resources', wide: true },
			{ id: 'upcoming', label: 'Upcoming', wide: true }
		]
	},
	{
		cols: 'grid gap-4 lg:grid-cols-2',
		panels: [
			{ id: 'chart-empire-size', label: 'Chart: empire size' },
			{ id: 'chart-pops', label: 'Chart: pops' },
			{ id: 'chart-score', label: 'Chart: score and power' },
			{ id: 'chart-agenda', label: 'Chart: council agenda' },
			{ id: 'chart-research', label: 'Chart: research per month' },
			{ id: 'chart-balance', label: 'Chart: net per month' },
			{ id: 'chart-stockpile', label: 'Chart: stockpile' },
			{ id: 'chart-income', label: 'Chart: income per month' }
		]
	},
	{ cols: '', panels: [{ id: 'colonies', label: 'Colonies', wide: true }] },
	{ cols: '', panels: [{ id: 'events', label: 'Events (log)', wide: true }] },
	{
		// side by side once both fit (about 1250 px), stacked in a split-view half
		cols: 'grid items-start gap-6 2xl:grid-cols-2',
		panels: [
			{ id: 'jobs', label: 'Jobs' },
			{ id: 'pop-resources', label: "Pops' resources per month" }
		]
	},
	{
		cols: 'grid gap-6 md:grid-cols-2 xl:grid-cols-4',
		panels: [
			{ id: 'score', label: 'Score' },
			{ id: 'leaders', label: 'Leaders' },
			{ id: 'ships', label: 'Ships' },
			{ id: 'edicts', label: 'Edicts' },
			{ id: 'modifiers', label: 'Empire modifiers' },
			{ id: 'blockers', label: 'Blockers to clear' },
			{ id: 'sectors', label: 'Sectors' },
			{ id: 'migration', label: 'Migration (summary)' },
			{ id: 'automation', label: 'Automation defaults' }
		]
	},
	{
		cols: 'grid items-start gap-6 2xl:grid-cols-2',
		panels: [
			{ id: 'government', label: 'Government' },
			{ id: 'traditions', label: 'Traditions' },
			{ id: 'fleet-movement', label: 'Fleet movement' },
			{ id: 'civilian-ships', label: 'Civilian ships' },
			{ id: 'starbases', label: 'Starbases' },
			{ id: 'shipyards', label: 'Shipyards' },
			{ id: 'research-tiers', label: 'Research tiers' },
			{ id: 'species', label: 'Species' },
			{ id: 'expansion', label: 'Expansion' }
		]
	}
] as const satisfies { cols: string; panels: { id: string; label: string; wide?: true }[] }[];

type Panel = (typeof LAYOUT)[number]['panels'][number] & { wide?: true };
export type PanelId = Panel['id'];
export const PANELS: Panel[] = LAYOUT.flatMap((g): Panel[] => [...g.panels]);
/** What a custom tab picks from; the header is its own switch, always on top. */
export const PICKABLE = PANELS.filter((p) => p.id !== 'header');
const panelIds = new Set<string>(PICKABLE.map((p) => p.id));
export const panelInfo = (id: PanelId) => PANELS.find((p) => p.id === id)!;

export function parseTheme(v: unknown): Theme | null {
	return THEMES.includes(v as Theme) ? (v as Theme) : null;
}

/**
 * The tabs if `v` is a well-formed list (names trimmed, unknown or repeated panels dropped). Tabs
 * saved when the header was a panel show it if they picked it.
 */
export function parseTabs(v: unknown): CustomTab[] | null {
	if (!Array.isArray(v)) return null;
	const tabs: CustomTab[] = [];
	for (const t of v) {
		if (typeof t?.id !== 'string' || !/^[\w-]{1,40}$/.test(t.id)) return null;
		if (typeof t.name !== 'string' || !Array.isArray(t.panels)) return null;
		if (tabs.some((o) => o.id === t.id)) return null;
		const name = t.name.trim().slice(0, 40) || 'tab';
		const panels = [...new Set<string>(t.panels.filter((p: unknown) => typeof p === 'string'))];
		tabs.push({
			id: t.id,
			name,
			header: t.header === true || panels.includes('header'),
			panels: panels.filter((p) => panelIds.has(p)) as PanelId[]
		});
	}
	return tabs;
}

/** Milestone kinds shown per chart, by chart key (`empire:<title>`, `colony:<title>`, `log`). */
export type ChartEvents = Record<string, EventKind[]>;

/** The entries of a well-formed map; unknown kinds dropped. */
export function parseChartEvents(v: unknown): ChartEvents | null {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
	const out: ChartEvents = {};
	for (const [key, kinds] of Object.entries(v)) {
		if (key.length > 80 || !Array.isArray(kinds)) return null;
		out[key] = [...new Set(kinds.filter((k) => KIND_IDS.includes(k)))] as EventKind[];
	}
	return out;
}

/**
 * Stores changed settings on the server (`/api/settings`). `chartEvents` entries are merged into
 * the stored map, so charts saving at once do not undo each other.
 */
export async function putSettings(patch: {
	theme?: Theme;
	tabs?: CustomTab[];
	chartEvents?: ChartEvents;
}) {
	const r = await fetch('/api/settings', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(patch)
	});
	if (!r.ok) throw new Error(`saving settings failed: ${r.status} ${await r.text()}`);
}
