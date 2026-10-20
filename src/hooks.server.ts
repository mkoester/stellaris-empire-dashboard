import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { start, status } from '#lib/server/app.ts';
import { theme } from '#lib/server/settings.ts';

export const init: ServerInit = start;

// Until the game folders are set (and the dashboard has started with them), every page leads to
// /setup. The stored theme goes on <html> before the page reaches the browser, so it never flashes.
export const handle: Handle = ({ event, resolve }) => {
	const running = status() === 'running';
	if (!running && !event.url.pathname.startsWith('/setup')) redirect(303, '/setup');
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme%', running ? theme() : 'system')
	});
};
