import { page } from '$app/state';
import type { EventKind } from './milestones.ts';
import { putSettings, type ChartEvents } from './settings.ts';

/**
 * The milestone kinds one chart (or the events panel) shows, stored server-side under `key`. A
 * toggle shows at once and is saved in the background.
 */
export function chartEvents(key: () => string) {
	let override: EventKind[] | null = $state(null);
	const stored = () => (page.data.chartEvents as ChartEvents | undefined)?.[key()] ?? [];
	const shown = $derived(override ?? stored());
	return {
		get shown() {
			return shown;
		},
		toggle(kind: EventKind) {
			const next = shown.includes(kind) ? shown.filter((k) => k !== kind) : [...shown, kind];
			override = next;
			putSettings({ chartEvents: { [key()]: next } }).catch((e) => console.error(e));
		}
	};
}
