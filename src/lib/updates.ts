// Whether a newer release of the dashboard is out: GitHub's `latest` release (prereleases and
// drafts are never `latest`) against the running version. Only a release build checks — a build
// from `develop` (`-<hash>`, `-SNAPSHOT`) or a release candidate / beta never does (the user,
// 2026-11-19). Pure; the timer and the request are `server/updates.ts`.

export const LATEST_RELEASE_API =
	'https://api.github.com/repos/mkoester/stellaris-empire-dashboard/releases/latest';

/** Hours between checks: the default, and the most ⚙ accepts (a week). 0 = never. */
export const DEFAULT_UPDATE_HOURS = 3;
export const MAX_UPDATE_HOURS = 168;

/**
 * A release: its version, its page, and the game version it was built for (`4.6.0`, from the
 * release title's `(v4.6.0)`; null for a title without one).
 */
export type Release = { version: string; url: string; game?: string | null };

/** What the last check found: `latest` null when there is no release, or before the first check. */
export type UpdateState = {
	checkedAt: number | null;
	latest: Release | null;
	error: string | null;
};

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;

/** A release build's version: `X.Y.Z`, nothing decorated (`scripts/version.mjs`). */
export const isRelease = (v: string) => RELEASE.test(v);

/** Whether release version `a` is newer than `b`; false when either is not `X.Y.Z`. */
export function isNewer(a: string, b: string): boolean {
	const x = RELEASE.exec(a);
	const y = RELEASE.exec(b);
	if (!x || !y) return false;
	for (let i = 1; i <= 3; i++)
		if (Number(x[i]) !== Number(y[i])) return Number(x[i]) > Number(y[i]);
	return false;
}

/** GitHub's release JSON as a release (`v0.1.28` → `0.1.28`), null when it is none. */
export function parseLatest(body: unknown): Release | null {
	if (typeof body !== 'object' || body === null) return null;
	const { tag_name: tag, html_url: url, name, draft, prerelease } = body as Record<string, unknown>;
	if (typeof tag !== 'string' || typeof url !== 'string' || draft || prerelease) return null;
	const version = tag.replace(/^v/, '');
	const game =
		typeof name === 'string' ? (/\(v(\d+(?:\.\d+)+)\)\s*$/.exec(name)?.[1] ?? null) : null;
	return isRelease(version) && url.startsWith('https://github.com/')
		? { version, url, game }
		: null;
}

const minor = (v: string | null | undefined) =>
	/(\d+)\.(\d+)/
		.exec(v ?? '')
		?.slice(1)
		.map(Number);

/**
 * The header's offer: `v0.2.2 available`, naming the game it was built for when that is not the
 * game being played (`playing`, the data's `Corona Borealis v4.5.4 (…)`): a maintenance build's
 * player on 4.5 is offered the 4.6 line, and should update the game first (the user, 2026-11-28).
 * Pure.
 */
export function offerLabel(r: Release, playing: string | null): string {
	const label = `v${r.version} available`;
	const want = minor(r.game);
	const have = minor(playing);
	if (!want || !have || (want[0] === have[0] && want[1] === have[1])) return label;
	const older = have[0] < want[0] || (have[0] === want[0] && have[1] < want[1]);
	const yours = /(\d+(?:\.\d+)+)/.exec(playing ?? '')?.[1];
	return `${label}, built for game ${want.join('.')}${older ? ` – you are still on ${yours}` : ''}`;
}

/** A stored or sent interval in hours (0 = never), or null when it is none. */
export function parseUpdateHours(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_UPDATE_HOURS ? v : null;
}

/** The release to offer: newer than the running one, which must be a release. */
export const updateOffer = (current: string, s: UpdateState): Release | null =>
	s.latest && isRelease(current) && isNewer(s.latest.version, current) ? s.latest : null;
