/** The data DB's game version (`Cygnus v4.5.3 (7793)`) without its name: `4.5.3 (7793)`. */
export const gameVersionNumber = (v: string) => v.replace(/^\D*/, '');

/** The launcher's start line names both: `v0.1.17 · game 4.5.3 (7793)`, the game left out if unknown. */
export const versionLine = (dashboard: string, game: string | null) =>
	game ? `v${dashboard} · game ${gameVersionNumber(game)}` : `v${dashboard}`;
