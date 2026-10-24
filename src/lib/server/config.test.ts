import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appDataDir, readConfig, resolvePaths, writeConfig } from './config.ts';

describe('appDataDir', () => {
	it('uses APPDATA on Windows', () => {
		expect(appDataDir('win32', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'C:\\Users\\a')).toBe(
			join('C:\\Users\\a\\AppData\\Roaming', 'stellaris-empire-dashboard')
		);
	});
	it('uses ~/Library/Application Support on macOS, whatever XDG_DATA_HOME says', () => {
		expect(appDataDir('darwin', { XDG_DATA_HOME: '/x' }, '/Users/a')).toBe(
			'/Users/a/Library/Application Support/stellaris-empire-dashboard'
		);
	});
	it('uses XDG_DATA_HOME, else ~/.local/share', () => {
		expect(appDataDir('linux', { XDG_DATA_HOME: '/x' }, '/home/a')).toBe(
			'/x/stellaris-empire-dashboard'
		);
		expect(appDataDir('linux', {}, '/home/a')).toBe(
			'/home/a/.local/share/stellaris-empire-dashboard'
		);
	});
});

describe('resolvePaths', () => {
	const app = '/app';
	it('is null until both folders are known', () => {
		expect(resolvePaths({}, {}, app)).toBeNull();
		expect(resolvePaths({}, { userDir: '/u' }, app)).toBeNull();
		expect(resolvePaths({}, { gameDir: '/g' }, app)).toBeNull();
	});
	it('derives the rest from the config', () => {
		expect(resolvePaths({}, { userDir: '/u', gameDir: '/g' }, app)).toEqual({
			dashboardDb: '/app/dashboard.sqlite',
			saveDir: '/u/save games',
			dataDb: undefined,
			gameDir: '/g',
			gameLog: '/u/logs/game.log'
		});
	});
	it('reads game.log beside the saves only when the user folder is the config’s', () => {
		expect(
			resolvePaths({ STELLARIS_SAVE_DIR: '/s' }, { userDir: '/u', gameDir: '/g' }, app)?.gameLog
		).toBeUndefined();
	});
	it('lets environment variables win, and a data DB stands in for the game folder', () => {
		const env = {
			DASHBOARD_DB: '/d.sqlite',
			STELLARIS_SAVE_DIR: '/s',
			STELLARIS_DATA_DB: '/data.sqlite',
			STELLARIS_GAME_LOG: '/game.log'
		};
		expect(resolvePaths(env, { userDir: '/u', gameDir: '/g' }, app)).toEqual({
			dashboardDb: '/d.sqlite',
			saveDir: '/s',
			dataDb: '/data.sqlite',
			gameDir: '/g',
			gameLog: '/game.log'
		});
		expect(resolvePaths(env, {}, app)?.dataDb).toBe('/data.sqlite');
	});
});

describe('readConfig / writeConfig', () => {
	it('round-trips, and reads a missing or broken file as empty', () => {
		const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
		expect(readConfig(dir)).toEqual({});
		writeConfig(join(dir, 'sub'), { userDir: '/u', gameDir: '/g' });
		expect(readConfig(join(dir, 'sub'))).toEqual({ userDir: '/u', gameDir: '/g' });
		writeFileSync(join(dir, 'config.json'), '{ not json');
		expect(readConfig(dir)).toEqual({});
	});
});
