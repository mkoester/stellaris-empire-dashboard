import { describe, expect, it } from 'vitest';
import { betaNote } from './steamBranch.ts';

describe('betaNote', () => {
	it('warns on a beta branch, naming it', () =>
		expect(betaNote('stellaris_test')).toContain('"stellaris_test"'));
	it('says nothing on the public branch or off Steam', () => {
		expect(betaNote('public')).toBeNull();
		expect(betaNote(null)).toBeNull();
	});
});
