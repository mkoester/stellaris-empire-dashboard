// Viewer settings kept on the server (`setting` table), so every device sees the same: the theme
// and the custom tabs. Requests carry them as JSON; the parsers reject anything malformed.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** A tab of one's own: a name and the panels it shows, in order. */
export type CustomTab = { id: string; name: string; panels: PanelId[] };

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
			{ id: 'sectors', label: 'Sectors' },
			{ id: 'migration', label: 'Migration (summary)' },
			{ id: 'automation', label: 'Automation defaults' }
		]
	},
	{
		cols: 'grid items-start gap-6 2xl:grid-cols-2',
		panels: [
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
const panelIds = new Set<string>(PANELS.map((p) => p.id));
export const panelInfo = (id: PanelId) => PANELS.find((p) => p.id === id)!;

export function parseTheme(v: unknown): Theme | null {
	return THEMES.includes(v as Theme) ? (v as Theme) : null;
}

/** The tabs if `v` is a well-formed list (names trimmed, unknown or repeated panels dropped). */
export function parseTabs(v: unknown): CustomTab[] | null {
	if (!Array.isArray(v)) return null;
	const tabs: CustomTab[] = [];
	for (const t of v) {
		if (typeof t?.id !== 'string' || !/^[\w-]{1,40}$/.test(t.id)) return null;
		if (typeof t.name !== 'string' || !Array.isArray(t.panels)) return null;
		if (tabs.some((o) => o.id === t.id)) return null;
		const name = t.name.trim().slice(0, 40) || 'tab';
		const panels = [...new Set<string>(t.panels.filter((p: unknown) => typeof p === 'string'))];
		tabs.push({ id: t.id, name, panels: panels.filter((p) => panelIds.has(p)) as PanelId[] });
	}
	return tabs;
}

/** Stores changed settings on the server (`/api/settings`). */
export async function putSettings(patch: { theme?: Theme; tabs?: CustomTab[] }) {
	const r = await fetch('/api/settings', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(patch)
	});
	if (!r.ok) throw new Error(`saving settings failed: ${r.status} ${await r.text()}`);
}
