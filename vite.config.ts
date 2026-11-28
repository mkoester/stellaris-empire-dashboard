import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { decoratedVersion } from './scripts/version.mjs';

// The game version this release is built for: the companion mod's `supported_version`, which
// moves with each game version anyway (`#lib/gameNote.ts` warns about any other game).
const gameTarget = /^supported_version="([^"]+)"/m.exec(
	readFileSync(new URL('./mod/dashboard_feed/descriptor.mod', import.meta.url), 'utf8')
)?.[1];
if (!gameTarget) throw new Error('mod/dashboard_feed/descriptor.mod names no supported_version');

export default defineConfig({
	define: {
		// shown in the header: which build this is (scripts/version.mjs)
		__APP_VERSION__: JSON.stringify(decoratedVersion()),
		__GAME_TARGET__: JSON.stringify(gameTarget)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-node: `node build` runs the dashboard locally next to the game.
			adapter: adapter()
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
