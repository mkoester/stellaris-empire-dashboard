import { describe, expect, it } from 'vitest';
import { gameVersionNumber, versionLine } from './versions.ts';

describe('gameVersionNumber', () => {
	it('drops the version name', () =>
		expect(gameVersionNumber('Cygnus v4.5.3 (7793)')).toBe('4.5.3 (7793)'));
	it('keeps a bare number', () => expect(gameVersionNumber('4.3.4')).toBe('4.3.4'));
});

describe('versionLine', () => {
	it('names the dashboard and the game', () =>
		expect(versionLine('0.1.17', 'Cygnus v4.5.3 (7793)')).toBe('v0.1.17 · game 4.5.3 (7793)'));
	it('leaves the game out when unknown', () => expect(versionLine('0.1.17', null)).toBe('v0.1.17'));
});
