// The warning for a game on one of Steam's beta branches (an open beta, `stellaris_test`): a
// release of the dashboard is built and checked against the public game, and a beta renames,
// moves and adds what the dashboard reads. Shown on /setup and above every page (2026-11-28).

/** What to tell a player whose game is on `branch`; null on the public branch or off Steam. Pure. */
export function betaNote(branch: string | null): string | null {
	if (branch === null || branch === 'public') return null;
	return (
		`The game is on Steam's beta branch "${branch}". This dashboard is built for the public ` +
		'game: names, numbers or whole tabs may be missing or wrong, and the game data may fail to ' +
		'extract. Switch the game back in Steam (Properties → Betas → None), or expect gaps until a ' +
		'dashboard release for that game version.'
	);
}
