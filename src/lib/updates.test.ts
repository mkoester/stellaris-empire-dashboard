import { describe, expect, it } from 'vitest';
import {
	isNewer,
	isRelease,
	offerLabel,
	parseLatest,
	parseUpdateHours,
	updateOffer
} from './updates.ts';

const gh = (tag: string, more: Record<string, unknown> = {}) => ({
	tag_name: tag,
	html_url: `https://github.com/mkoester/stellaris-empire-dashboard/releases/tag/${tag}`,
	draft: false,
	prerelease: false,
	...more
});

describe('isRelease', () => {
	it('only an undecorated version', () => {
		expect(isRelease('0.1.27')).toBe(true);
		for (const v of ['0.1.27-SNAPSHOT', '0.1.27-abc1234', '0.1.28-rc.1', '0.1.28-beta.2'])
			expect(isRelease(v)).toBe(false);
	});
});

describe('isNewer', () => {
	it('compares numerically, part by part', () => {
		expect(isNewer('0.1.28', '0.1.27')).toBe(true);
		expect(isNewer('0.1.10', '0.1.9')).toBe(true);
		expect(isNewer('0.2.0', '0.1.99')).toBe(true);
		expect(isNewer('0.1.27', '0.1.27')).toBe(false);
		expect(isNewer('0.1.26', '0.1.27')).toBe(false);
		expect(isNewer('0.1.28', '0.1.27-SNAPSHOT')).toBe(false);
	});
});

describe('parseLatest', () => {
	it('reads the tag without its v, and the release page', () => {
		expect(parseLatest(gh('v0.1.28'))).toEqual({
			version: '0.1.28',
			url: 'https://github.com/mkoester/stellaris-empire-dashboard/releases/tag/v0.1.28',
			game: null
		});
	});

	it('reads the game version from the release title', () => {
		expect(
			parseLatest(gh('v0.2.2', { name: 'Stellaris Empire Dashboard 0.2.2 (v4.6.0)' }))?.game
		).toBe('4.6.0');
		expect(
			parseLatest(gh('v0.2.2', { name: 'Stellaris Empire Dashboard 0.2.2' }))?.game
		).toBeNull();
	});

	it('refuses prereleases, drafts, odd tags and foreign links', () => {
		expect(parseLatest(gh('v0.1.28-rc.1', { prerelease: true }))).toBeNull();
		expect(parseLatest(gh('v0.1.28', { draft: true }))).toBeNull();
		expect(parseLatest(gh('nightly'))).toBeNull();
		expect(parseLatest({ ...gh('v0.1.28'), html_url: 'https://example.com/x' })).toBeNull();
		expect(parseLatest({ message: 'Not Found' })).toBeNull();
		expect(parseLatest(null)).toBeNull();
	});
});

describe('parseUpdateHours', () => {
	it('0 (never) up to a week', () => {
		expect(parseUpdateHours(0)).toBe(0);
		expect(parseUpdateHours(3)).toBe(3);
		expect(parseUpdateHours(0.5)).toBe(0.5);
		expect(parseUpdateHours(169)).toBeNull();
		expect(parseUpdateHours(-1)).toBeNull();
		expect(parseUpdateHours('3')).toBeNull();
		expect(parseUpdateHours(undefined)).toBeNull();
	});
});

describe('updateOffer', () => {
	const latest = { version: '0.1.28', url: 'https://github.com/x' };
	const s = { checkedAt: 1, latest, error: null };
	it('a newer release, for a release build only', () => {
		expect(updateOffer('0.1.27', s)).toBe(latest);
		expect(updateOffer('0.1.28', s)).toBeNull();
		expect(updateOffer('0.1.27-abc1234', s)).toBeNull();
		expect(updateOffer('0.1.27', { ...s, latest: null })).toBeNull();
	});
});

describe('offerLabel', () => {
	const r = { version: '0.2.2', url: 'https://github.com/x', game: '4.6.0' };
	it('names the game when it is not the one played', () => {
		expect(offerLabel(r, 'Cygnus v4.5.4 (1a2b)')).toBe(
			'v0.2.2 available, built for game 4.6 – you are still on 4.5.4'
		);
		expect(offerLabel(r, 'Corona Borealis v4.7.0 (ffff)')).toBe(
			'v0.2.2 available, built for game 4.6'
		);
	});
	it('says only the version for the game played, or when either is unknown', () => {
		expect(offerLabel(r, 'Corona Borealis v4.6.1 (3d1a)')).toBe('v0.2.2 available');
		expect(offerLabel({ ...r, game: null }, 'Cygnus v4.5.4 (1a2b)')).toBe('v0.2.2 available');
		expect(offerLabel(r, null)).toBe('v0.2.2 available');
	});
});
