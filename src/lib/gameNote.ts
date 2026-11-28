// The warning for a game this release was not built for, shown on /setup and above every page
// (2026-11-28). A release is built and checked against one game version, `__GAME_TARGET__` (the
// companion mod's `supported_version`, `vite.config.ts`); an older game lacks what the dashboard
// reads, a newer one or an open beta renames, moves and adds it. Steam's Betas list also rolls
// the game back to old versions, very far: before `OLDEST` it will most likely not work at all.

/** The oldest game version a dashboard release was built for (the user, 2026-11-28). */
export const OLDEST = '4.5';

/** Where the earlier releases are, each built for its game version (without the scheme: the lint). */
export const RELEASES_PAGE = 'github.com/mkoester/stellaris-empire-dashboard/releases';

/** The warning, and whether another release on `RELEASES_PAGE` may fit the game. */
export type GameNote = { text: string; releases: boolean };

/** `major.minor` of a version string (`v4.6.*`, `v4.5.4`, `Cygnus v4.5.3 (7793)`), null without. */
const minorOf = (v: string | null): [number, number] | null => {
	const m = /(\d+)\.(\d+)/.exec(v ?? '');
	return m ? [Number(m[1]), Number(m[2])] : null;
};

const compare = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];

const STEAM_UPDATE = 'Update the game in Steam (Properties → Betas → None)';

/**
 * What to tell a player whose game is `version` (`v4.5.4`, from `launcher-settings.json`) on
 * Steam branch `branch` (null off Steam), for a release built for `target` (`v4.6.*`); null when
 * it fits. One note, the version's before the branch's: a rollback is a branch too. Pure.
 */
export function gameNote(
	version: string | null,
	branch: string | null,
	target: string
): GameNote | null {
	const note = (text: string, releases = false): GameNote => ({ text, releases });
	const have = minorOf(version);
	const want = minorOf(target);
	const oldest = minorOf(OLDEST)!;
	if (have && want) {
		const built = `This dashboard is built for the game's ${want.join('.')}`;
		if (compare(have, oldest) < 0)
			return note(
				`The game is ${version}. ${built}, and versions before ${OLDEST} will most likely not ` +
					`work: the game data may fail to extract and saves fail to read. ${STEAM_UPDATE}.`
			);
		if (compare(have, want) < 0)
			return note(
				`The game is ${version}. ${built}: names, numbers or whole tabs may be missing or ` +
					`wrong. An earlier release of the dashboard is built for ${have.join('.')}: find it ` +
					`among the releases on GitHub. Or ${STEAM_UPDATE.replace(/^U/, 'u')}.`,
				true
			);
		if (compare(have, want) > 0)
			return note(
				`The game is ${version}. ${built}: what the newer game changed may be missing or ` +
					'wrong until a dashboard release for it: look among the releases on GitHub.',
				true
			);
	}
	if (branch !== null && branch !== 'public')
		return note(
			`The game is on Steam's beta branch "${branch}". This dashboard is built for the public ` +
				'game: names, numbers or whole tabs may be missing or wrong, and the game data may fail ' +
				`to extract. Switch the game back in Steam (Properties → Betas → None), or expect gaps ` +
				'until a dashboard release for that game version.'
		);
	return null;
}
