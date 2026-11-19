import {
	LATEST_RELEASE_API,
	isRelease,
	parseLatest,
	updateOffer,
	type Release,
	type UpdateState
} from '#lib/updates.ts';

// Checks GitHub for a newer release: once the dashboard has started, then every `hours` (⚙,
// `updateHours()`; 0 = never), and only in a release build (#lib/updates.ts). Kept on globalThis
// like the watcher (`app.ts`): Vite re-imports server modules, and a second timer would check twice.
// The timer is unref'd, so it never keeps a stopping launcher alive.

type Deps = { version: string; fetch: typeof fetch; now: () => number };
type Checks = UpdateState & { timer?: ReturnType<typeof setTimeout>; hours: number };

const g = globalThis as typeof globalThis & { __stellarisDashboardUpdates?: Checks };
const checks: Checks = (g.__stellarisDashboardUpdates ??= {
	checkedAt: null,
	latest: null,
	error: null,
	hours: 0
});

const HOUR_MS = 3600_000;
const TIMEOUT_MS = 15_000;

const defaults = (): Deps => ({ version: __APP_VERSION__, fetch, now: Date.now });

/** One request for GitHub's latest release; a failure is kept as `error`, never thrown. */
export async function checkForUpdate(deps: Deps = defaults()): Promise<UpdateState> {
	try {
		const r = await deps.fetch(LATEST_RELEASE_API, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'stellaris-empire-dashboard'
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		// 404: no release yet
		if (!r.ok && r.status !== 404) throw new Error(`GitHub answered ${r.status}`);
		const latest = r.ok ? parseLatest(await r.json()) : null;
		const before = updateOffer(deps.version, checks)?.version;
		Object.assign(checks, { checkedAt: deps.now(), latest, error: null });
		const offer = updateOffer(deps.version, checks);
		if (offer && offer.version !== before)
			console.log(`dashboard ${offer.version} is out (this is ${deps.version}): ${offer.url}`);
	} catch (e) {
		Object.assign(checks, { checkedAt: deps.now(), error: (e as Error).message });
		console.warn('cannot check for a newer dashboard:', (e as Error).message);
	}
	return updateState();
}

/**
 * Checks every `hours` from the last check — now when none was made or it is due —, replacing any
 * schedule before it. Nothing in a build that is not a release, or with 0 hours.
 */
export function scheduleUpdateChecks(hours: number, deps: Deps = defaults()) {
	clearTimeout(checks.timer);
	checks.timer = undefined;
	checks.hours = hours;
	if (!isRelease(deps.version) || hours <= 0) return;
	const next = () => {
		// within one interval also when the last check reads as later than now (the clock set back)
		const due = (checks.checkedAt ?? -Infinity) + hours * HOUR_MS - deps.now();
		const wait = Math.min(Math.max(0, due), hours * HOUR_MS);
		checks.timer = setTimeout(() => {
			checkForUpdate(deps)
				.then(next)
				.catch((e) => console.error('update check:', e));
		}, wait);
		checks.timer.unref?.();
	};
	next();
}

export const stopUpdateChecks = () => {
	clearTimeout(checks.timer);
	checks.timer = undefined;
};

/** What the last check found. */
export const updateState = (): UpdateState => ({
	checkedAt: checks.checkedAt,
	latest: checks.latest,
	error: checks.error
});

/** The release to offer this build, if a newer one is out. */
export const updateAvailable = (version: string = __APP_VERSION__): Release | null =>
	updateOffer(version, checks);
