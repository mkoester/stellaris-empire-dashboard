import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { start } from '#lib/server/app.ts';
import { theme } from '#lib/server/settings.ts';

export const init: ServerInit = start;

// The stored theme goes on <html> before the page reaches the browser, so it never flashes.
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => html.replace('%theme%', theme()) });
