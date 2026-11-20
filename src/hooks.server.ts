import { error, redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { start, startVersions, status } from '#lib/server/app.ts';
import { refusal } from '#lib/server/guard.ts';
import { theme } from '#lib/server/settings.ts';

export const init: ServerInit = start;

// The packaged launcher's start line names the versions (`release/launcher.mjs`): the app is its
// own bundle there, so the launcher finds this on globalThis once the handler module has loaded.
(globalThis as Record<symbol, unknown>)[Symbol.for('stellaris-dashboard.startVersions')] =
	startVersions;

// A request under a foreign name, a write from another site, or a change of the folders or the
// campaigns from another device is refused (`guard.ts`).
// Until the game folders are set (and the dashboard has started with them), every page leads to
// /setup. The stored theme goes on <html> before the page reaches the browser, so it never flashes.
export const handle: Handle = ({ event, resolve }) => {
	const refused = refusal({
		host: event.url.host,
		client: event.getClientAddress(),
		method: event.request.method,
		path: event.url.pathname,
		origin: event.request.headers.get('origin'),
		self: event.url.origin
	});
	if (refused) error(403, refused);
	const running = status() === 'running';
	if (!running && !event.url.pathname.startsWith('/setup')) redirect(303, '/setup');
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme%', running ? theme() : 'system')
	});
};
