import { describe, expect, it } from 'vitest';
import { gameNote } from './gameNote.ts';

const TARGET = 'v4.6.*';

describe('gameNote', () => {
	it('says nothing for the version it was built for, on the public branch or off Steam', () => {
		expect(gameNote('v4.6.0', 'public', TARGET)).toBeNull();
		expect(gameNote('v4.6.2', null, TARGET)).toBeNull();
	});
	it('warns on a beta branch of the same version (the 4.6.1 open beta)', () =>
		expect(gameNote('v4.6.1', 'stellaris_test', TARGET)).toContain('beta branch "stellaris_test"'));
	it('warns on an older game that may mostly work (the player of 2026-11-28 on 4.5.4)', () => {
		const note = gameNote('v4.5.4', 'public', TARGET);
		expect(note).toContain('The game is v4.5.4');
		expect(note).toContain("built for the game's 4.6");
		expect(note).not.toContain('most likely not work');
	});
	it('says a game before 4.5 will most likely not work, branch or not', () => {
		expect(gameNote('v4.3.4', 'public', TARGET)).toContain('before 4.5 will most likely not work');
		expect(gameNote('v3.14.1', 'stellaris_3.14', TARGET)).toContain('most likely not work');
	});
	it("gives a rollback branch the version's note, not the beta's", () =>
		expect(gameNote('v4.5.4', 'stellaris_4.5', TARGET)).not.toContain('beta branch'));
	it('warns on a newer game', () => {
		expect(gameNote('v4.7.0', 'public', TARGET)).toContain('newer game');
		expect(gameNote('v5.0.0', 'public', TARGET)).toContain('newer game');
	});
	it('falls back to the branch when the version is unknown', () => {
		expect(gameNote(null, 'stellaris_test', TARGET)).toContain('beta branch');
		expect(gameNote(null, 'public', TARGET)).toBeNull();
	});
});
