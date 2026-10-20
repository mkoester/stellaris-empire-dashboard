import { fail, redirect } from '@sveltejs/kit';
import { configure, setupState, status } from '#lib/server/app.ts';
import { discover, isGameDir, isUserDir } from '#lib/server/locate.ts';
import type { Actions } from './$types';

// Picks the game's two folders: offers what `discover()` finds, takes any typed path that holds
// the game's files, stores them (`config.json`) and starts the dashboard.
export function load() {
	return { ...setupState(), found: discover() };
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const gameDir = String(form.get('gameDir') ?? '').trim();
		const userDir = String(form.get('userDir') ?? '').trim();
		const errors = {
			gameDir: isGameDir(gameDir)
				? undefined
				: 'no Stellaris install here (launcher-settings.json and common/)',
			userDir: isUserDir(userDir)
				? undefined
				: 'no Stellaris user folder here (save games/ or settings.txt)'
		};
		if (errors.gameDir || errors.userDir) return fail(400, { errors, gameDir, userDir });

		const { restart } = await configure({ ...setupState().config, gameDir, userDir });
		if (restart) return { restart: true };
		if (status() !== 'running') return fail(500, { error: setupState().error, gameDir, userDir });
		redirect(303, '/');
	}
};
