import { describe, expect, it } from 'vitest';
import { upgrade } from '#lib/upgrade.ts';
import { getSetting, openDb, record, setSetting } from './db.ts';
import { activeProfile, campaignsOf, profileAction, profiles, updateProfile } from './settings.ts';

const play = (db: ReturnType<typeof openDb>, campaign: string, date: string) =>
	record(db, upgrade({ kind: 'save', campaign, date, fingerprint: campaign + date }), 't');

describe('profiles', () => {
	it('starts with a default profile made from the settings stored before profiles', () => {
		const db = openDb(':memory:');
		setSetting(db, 'tabs', [{ id: 't1', name: 'mine', header: true, panels: ['jobs'] }]);
		setSetting(db, 'colonyView', { mode: 'sector' });
		expect(profiles(db)).toEqual([{ id: 'default', name: 'default' }]);
		const p = activeProfile(db);
		expect(p.settings.tabs.map((t) => t.name)).toEqual(['mine']);
		expect(p.settings.colonyView.mode).toBe('sector');
	});

	it('writes into the profile in use only', () => {
		const db = openDb(':memory:');
		const b = profileAction(db, { action: 'create', name: 'Wide' })!;
		updateProfile(db, {
			display: {
				colonyRowLine: 'thick',
				expansionRowLine: 'medium',
				habitatsAlways: false,
				anomalySpoilers: false,
				projectSpoilers: false,
				contactStations: false,
				wholeGalaxy: false,
				unknownStars: false,
				wormholeLinks: true,
				wormholePairs: false,
				lgates: false,
				surveyAll: false,
				showLocked: false,
				factionTypes: false,
				allFactionTypes: false,
				tradeoffs: false
			}
		});
		expect(activeProfile(db).settings.display.colonyRowLine).toBe('thick');
		profileAction(db, { action: 'select', id: b });
		expect(activeProfile(db).settings.display.colonyRowLine).toBe('medium');
	});

	it('remembers the profile picked per campaign', () => {
		const db = openDb(':memory:');
		const wide = profileAction(db, { action: 'create', name: 'Wide' })!;
		play(db, 'une', '2200.01.01');
		profileAction(db, { action: 'select', id: wide });
		play(db, 'blorg', '2300.01.01'); // another campaign: the last pick still holds
		expect(activeProfile(db).id).toBe(wide);
		profileAction(db, { action: 'select', id: 'default' });
		play(db, 'une', '2200.02.01'); // back to the first: its own profile again
		expect(activeProfile(db).id).toBe(wide);
		expect(campaignsOf(db)).toEqual({ [wide]: ['une'], default: ['blorg'] });
	});

	it('copies, renames uniquely, imports and keeps the last profile', () => {
		const db = openDb(':memory:');
		updateProfile(db, {
			display: {
				colonyRowLine: 'thin',
				expansionRowLine: 'medium',
				habitatsAlways: false,
				anomalySpoilers: false,
				projectSpoilers: false,
				contactStations: false,
				wholeGalaxy: false,
				unknownStars: false,
				wormholeLinks: true,
				wormholePairs: false,
				lgates: false,
				surveyAll: false,
				showLocked: false,
				factionTypes: false,
				allFactionTypes: false,
				tradeoffs: false
			}
		});
		const copy = profileAction(db, { action: 'create', name: 'default', copyOf: 'default' })!;
		expect(profiles(db).map((p) => p.name)).toEqual(['default', 'default (2)']);
		expect(getSetting(db, `profile:${copy}`)).toMatchObject({ display: { colonyRowLine: 'thin' } });
		profileAction(db, { action: 'rename', id: copy, name: 'default' });
		expect(profiles(db)[1].name).toBe('default (2)');
		expect(profileAction(db, { action: 'delete', id: copy })).toBe(copy);
		expect(profileAction(db, { action: 'delete', id: 'default' })).toBeNull();
		const imported = profileAction(db, {
			action: 'import',
			name: 'Tall',
			settings: activeProfile(db).settings
		})!;
		expect(profiles(db).find((p) => p.id === imported)?.name).toBe('Tall');
	});
});
