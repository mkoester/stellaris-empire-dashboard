import { describe, expect, it } from 'vitest';
import { gameNote } from './gameNote.ts';

const TARGET = 'v4.6.*';

describe('gameNote', () => {
	it('says nothing for the version it was built for, on the public branch or off Steam', () => {
		expect(gameNote('v4.6.0', 'public', TARGET)).toBeNull();
		expect(gameNote('v4.6.2', null, TARGET)).toBeNull();
	});
	it('warns on a beta branch of the same version (the 4.6.1 open beta)', () =>
		expect(gameNote('v4.6.1', 'stellaris_test', TARGET)?.text).toContain(
			'beta branch "stellaris_test"'
		));
	it('warns on an older game that may mostly work (the player of 2026-11-28 on 4.5.4)', () => {
		const note = gameNote('v4.5.4', 'public', TARGET);
		expect(note?.text).toContain('The game is v4.5.4');
		expect(note?.text).toContain("built for the game's 4.6");
		expect(note?.text).toContain('An earlier release of the dashboard is built for 4.5');
		expect(note?.releases).toBe(true);
	});
	it('says a game before 4.5 will most likely not work, branch or not', () => {
		const note = gameNote('v4.3.4', 'public', TARGET);
		expect(note?.text).toContain('before 4.5 will most likely not work');
		expect(note?.releases).toBe(false); // no release was built for it
		expect(gameNote('v3.14.1', 'stellaris_3.14', TARGET)?.text).toContain('most likely not work');
	});
	it("gives a rollback branch the version's note, not the beta's", () =>
		expect(gameNote('v4.5.4', 'stellaris_4.5', TARGET)?.text).not.toContain('beta branch'));
	it('points an older supported or a newer game to the releases, a beta not', () => {
		expect(gameNote('v4.7.0', 'public', TARGET)?.releases).toBe(true);
		// a 4.5 maintenance build on a 4.6 game: 0.2.x is the release for it
		expect(gameNote('v4.6.0', 'public', 'v4.5.*')?.releases).toBe(true);
		expect(gameNote('v4.6.1', 'stellaris_test', TARGET)?.releases).toBe(false);
	});
	it('warns on a newer game', () => {
		expect(gameNote('v4.7.0', 'public', TARGET)?.text).toContain('newer game');
		expect(gameNote('v5.0.0', 'public', TARGET)?.text).toContain('newer game');
	});
	it('falls back to the branch when the version is unknown', () => {
		expect(gameNote(null, 'stellaris_test', TARGET)?.text).toContain('beta branch');
		expect(gameNote(null, 'public', TARGET)).toBeNull();
	});
});
