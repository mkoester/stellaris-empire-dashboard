import { describe, expect, it } from 'vitest';
import { APP_TITLE, pageTitle } from './pageTitle.ts';

const fixed = [
	{ name: 'all', active: false },
	{ name: 'trade deals', active: true }
];

describe('pageTitle', () => {
	it('names the active fixed tab, capitalised', () => {
		expect(pageTitle('/deals', fixed, [])).toBe(`Trade deals - ${APP_TITLE}`);
	});
	it('names a custom tab by its id', () => {
		const none = fixed.map((t) => ({ ...t, active: false }));
		expect(pageTitle('/tab/ab12', none, [{ id: 'ab12', name: 'my economy' }])).toBe(
			`My economy - ${APP_TITLE}`
		);
	});
	it('falls back to the first path segment', () => {
		expect(pageTitle('/settings', [], [])).toBe(`Settings - ${APP_TITLE}`);
		expect(pageTitle('/planet/12', [], [])).toBe(`Planet - ${APP_TITLE}`);
		expect(pageTitle('/tab/gone', [], [])).toBe(`Tab - ${APP_TITLE}`);
		expect(pageTitle('/', [], [])).toBe(`All - ${APP_TITLE}`);
	});
});
