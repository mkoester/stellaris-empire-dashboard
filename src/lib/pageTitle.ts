// The window title: the tab shown, then the app — "Colonies - Empire Dashboard (Stellaris)". Pure.

export const APP_TITLE = 'Empire Dashboard (Stellaris)';

/** The title for `path`: the active fixed tab's name, a custom tab's (`/tab/<id>`), else the
 * page's first path segment — settings, timeline, setup, a planet. */
export function pageTitle(
	path: string,
	fixed: { name: string; active: boolean }[],
	custom: { id: string; name: string }[]
): string {
	const id = /^\/tab\/([^/]+)/.exec(path)?.[1];
	const name =
		fixed.find((t) => t.active)?.name ??
		(id === undefined ? null : custom.find((t) => t.id === id)?.name) ??
		(path.split('/').find(Boolean)?.replaceAll(/[-_]/g, ' ') || 'all');
	return `${name[0].toUpperCase()}${name.slice(1)} - ${APP_TITLE}`;
}
