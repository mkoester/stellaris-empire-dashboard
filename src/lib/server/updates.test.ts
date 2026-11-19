import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// the checks' state is per process (globalThis): each test starts from a fresh one
let m: typeof import('./updates.ts');

const HOUR = 3600_000;
const release = (tag: string) => ({
	tag_name: tag,
	html_url: `https://github.com/mkoester/stellaris-empire-dashboard/releases/tag/${tag}`,
	draft: false,
	prerelease: false
});

// a fake GitHub: answers with `body` (status 200) or `status`, and counts the requests
function github(answer: { body?: unknown; status?: number }) {
	const f = vi.fn(async () =>
		answer.status
			? new Response('', { status: answer.status })
			: new Response(JSON.stringify(answer.body))
	);
	return f as unknown as typeof fetch & typeof f;
}
const deps = (version: string, fetch: typeof globalThis.fetch) => ({
	version,
	fetch,
	now: Date.now
});

describe('update checks', () => {
	beforeEach(async () => {
		delete (globalThis as Record<string, unknown>).__stellarisDashboardUpdates;
		vi.resetModules();
		m = await import('./updates.ts');
		vi.useFakeTimers();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		m.stopUpdateChecks();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('a build from develop or a release candidate never asks', async () => {
		const f = github({ body: release('v9.9.9') });
		for (const v of ['0.1.27-abc1234', '0.1.27-SNAPSHOT', '0.1.28-rc.1']) {
			m.scheduleUpdateChecks(3, deps(v, f));
			await vi.advanceTimersByTimeAsync(10 * HOUR);
		}
		expect(f).not.toHaveBeenCalled();
	});

	it('0 hours never asks', async () => {
		const f = github({ body: release('v9.9.9') });
		m.scheduleUpdateChecks(0, deps('0.1.27', f));
		await vi.advanceTimersByTimeAsync(10 * HOUR);
		expect(f).not.toHaveBeenCalled();
	});

	it('asks at once, then every interval, and offers a newer release', async () => {
		const f = github({ body: release('v0.1.28') });
		m.scheduleUpdateChecks(3, deps('0.1.27', f));
		await vi.advanceTimersByTimeAsync(0);
		expect(f).toHaveBeenCalledTimes(1);
		expect(m.updateAvailable('0.1.27')?.version).toBe('0.1.28');
		expect(m.updateAvailable('0.1.28')).toBeNull();
		await vi.advanceTimersByTimeAsync(3 * HOUR - 1);
		expect(f).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('a new interval counts from the last check, not from now', async () => {
		const f = github({ body: release('v0.1.28') });
		m.scheduleUpdateChecks(3, deps('0.1.27', f));
		await vi.advanceTimersByTimeAsync(HOUR);
		const before = f.mock.calls.length;
		m.scheduleUpdateChecks(2, deps('0.1.27', f)); // 1 h after the check: due in 1 h
		await vi.advanceTimersByTimeAsync(HOUR - 1);
		expect(f.mock.calls.length).toBe(before);
		await vi.advanceTimersByTimeAsync(1);
		expect(f.mock.calls.length).toBe(before + 1);
	});

	it('a last check later than now (the clock set back) waits one interval at most', async () => {
		const f = github({ body: release('v0.1.28') });
		m.scheduleUpdateChecks(3, deps('0.1.27', f));
		await vi.advanceTimersByTimeAsync(0);
		vi.setSystemTime(Date.now() - 24 * HOUR);
		m.scheduleUpdateChecks(3, deps('0.1.27', f));
		await vi.advanceTimersByTimeAsync(3 * HOUR);
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('keeps a failure as the error, and no release on a 404', async () => {
		m.scheduleUpdateChecks(3, deps('0.1.27', github({ status: 500 })));
		await vi.advanceTimersByTimeAsync(3 * HOUR);
		expect(m.updateState().error).toBe('GitHub answered 500');
		m.scheduleUpdateChecks(3, deps('0.1.27', github({ status: 404 })));
		await vi.advanceTimersByTimeAsync(3 * HOUR);
		expect(m.updateState()).toMatchObject({ latest: null, error: null });
	});
});
