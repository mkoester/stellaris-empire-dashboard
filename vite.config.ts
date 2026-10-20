import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vitest/config';
import { decoratedVersion } from './scripts/version.mjs';

export default defineConfig({
	// shown in the header: which build this is (scripts/version.mjs)
	define: { __APP_VERSION__: JSON.stringify(decoratedVersion()) },
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
