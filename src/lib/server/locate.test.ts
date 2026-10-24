import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	discover,
	expandEnv,
	gameDirGuesses,
	parseRegQuery,
	parseVdf,
	steamLibraries,
	userDirGuesses,
	type Machine
} from './locate.ts';

// Shape of a real libraryfolders.vdf (Linux, 2026-10-20), paths made generic.
const VDF = `"libraryfolders"
{
	"0"
	{
		"path"		"/home/player/.local/share/Steam"
		"label"		""
		"contentid"		"6941543482284790878"
		"apps"
		{
			"281990"		"123"
		}
	}
	"1"
	{
		"path"		"/mnt/games/SteamLibrary"
		// a comment
		"label"		"games"
	}
}`;

describe('parseVdf', () => {
	it('reads nested blocks and lists the libraries', () => {
		const vdf = parseVdf(VDF);
		expect(steamLibraries(vdf)).toEqual([
			'/home/player/.local/share/Steam',
			'/mnt/games/SteamLibrary'
		]);
		const first = (vdf.libraryfolders as Record<string, Record<string, unknown>>)['0'];
		expect(first.apps).toEqual({ '281990': '123' });
	});
	it('unescapes Windows paths', () => {
		const vdf = parseVdf('"libraryfolders" { "0" { "path" "D:\\\\SteamLibrary" } }');
		expect(steamLibraries(vdf)).toEqual(['D:\\SteamLibrary']);
	});
	it('is empty for something else', () => expect(steamLibraries(parseVdf('"x" { }'))).toEqual([]));
});

describe('registry values', () => {
	const out =
		'\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n\r\n';
	it('parses reg query output', () => {
		expect(parseRegQuery(out)).toEqual([
			{
				key: 'HKEY_CURRENT_USER\\Software\\Valve\\Steam',
				name: 'SteamPath',
				value: 'c:/program files (x86)/steam'
			}
		]);
	});
	it('expands %VAR% case-insensitively and keeps unknown ones', () => {
		expect(expandEnv('%USERPROFILE%\\Documents', { UserProfile: 'C:\\Users\\a' })).toBe(
			'C:\\Users\\a\\Documents'
		);
		expect(expandEnv('%NOPE%\\x', {})).toBe('%NOPE%\\x');
	});
});

const win = (values: Record<string, string>, folders: Record<string, string[]> = {}) => {
	const m: Machine = {
		platform: 'win32',
		home: 'C:\\Users\\a',
		env: { USERPROFILE: 'C:\\Users\\a' },
		reg: (key) => values[key] ?? null
	};
	return { m, list: (dir: string) => folders[dir] ?? [] };
};

describe('Windows guesses', () => {
	it('takes GOG install paths from the registry', () => {
		const { m } = win({
			'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games':
				'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1508702879\n    path    REG_SZ    E:\\Games\\Stellaris\n' +
				'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1\n    path    REG_SZ    E:\\Games\\Other\n'
		});
		const guesses = gameDirGuesses(m, ['D:\\SteamLibrary']);
		expect(guesses[0]).toEqual(['D:\\SteamLibrary\\steamapps\\common\\Stellaris', 'Steam']);
		expect(guesses).toContainEqual(['E:\\Games\\Stellaris', 'GOG']);
		expect(guesses.map(([d]) => d)).not.toContain('E:\\Games\\Other');
		expect(guesses).toContainEqual(['C:\\XboxGames\\Stellaris\\Content', 'Microsoft Store']);
	});
	it('follows a redirected Documents folder', () => {
		const { m, list } = win(
			{
				'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders':
					'    Personal    REG_EXPAND_SZ    %USERPROFILE%\\OneDrive - Work\\Dokumente\n'
			},
			{
				'C:\\Users\\a\\OneDrive - Work\\Dokumente\\Paradox Interactive': [
					'Stellaris',
					'Hearts of Iron IV'
				]
			}
		);
		expect(userDirGuesses(m, [], list)).toEqual([
			['C:\\Users\\a\\OneDrive - Work\\Dokumente\\Paradox Interactive\\Stellaris', 'Windows']
		]);
	});
});

describe('discover (Linux)', () => {
	const home = mkdtempSync(join(tmpdir(), 'home-'));
	const mk = (dir: string, files: Record<string, string> = {}) => {
		mkdirSync(dir, { recursive: true });
		for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
	};
	const steam = join(home, '.local', 'share', 'Steam');
	const lib2 = join(home, 'lib2');
	mk(join(steam, 'steamapps'), {
		'libraryfolders.vdf': `"libraryfolders" { "0" { "path" "${steam}" } "1" { "path" "${lib2}" } }`
	});
	const game = join(lib2, 'steamapps', 'common', 'Stellaris');
	mk(game, { 'launcher-settings.json': '{ "rawVersion": "v4.5.2" }' });
	mk(join(game, 'common'));
	const native = join(home, '.local', 'share', 'Paradox Interactive', 'Stellaris');
	const proton = join(
		lib2,
		'steamapps/compatdata/281990/pfx/drive_c/users/steamuser/Documents/Paradox Interactive/Stellaris'
	);
	mk(join(native, 'save games', 'old'), { 'autosave.sav': '' });
	mk(join(proton, 'save games', 'new'), { 'a.sav': '', 'b.sav': '' });
	utimesSync(join(native, 'save games', 'old', 'autosave.sav'), 1000, 1000);
	// a folder without the game's files is not offered
	mk(join(steam, 'steamapps', 'common', 'Stellaris'));

	it('finds the game in a second library and ranks user folders by newest save', () => {
		const { games, users } = discover({ platform: 'linux', home, env: {}, reg: () => null });
		expect(games).toEqual([{ dir: game, source: 'Steam', version: 'v4.5.2' }]);
		expect(users.map((u) => [u.dir, u.source, u.saves])).toEqual([
			[proton, 'Proton', 2],
			[native, 'Linux native', 1]
		]);
	});
});

describe('discover (macOS)', () => {
	const home = mkdtempSync(join(tmpdir(), 'home-'));
	const steam = join(home, 'Library', 'Application Support', 'Steam');
	const lib2 = join(home, 'lib2');
	mkdirSync(join(steam, 'steamapps'), { recursive: true });
	writeFileSync(
		join(steam, 'steamapps', 'libraryfolders.vdf'),
		`"libraryfolders" { "0" { "path" "${steam}" } "1" { "path" "${lib2}" } }`
	);
	const game = join(lib2, 'steamapps', 'common', 'Stellaris');
	mkdirSync(join(game, 'common'), { recursive: true });
	writeFileSync(join(game, 'launcher-settings.json'), '{ "rawVersion": "v4.5.2" }');
	const user = join(home, 'Documents', 'Paradox Interactive', 'Stellaris');
	mkdirSync(join(user, 'save games', 'c'), { recursive: true });
	writeFileSync(join(user, 'save games', 'c', 'a.sav'), '');
	// Linux's places are not looked at on a Mac
	mkdirSync(join(home, '.local', 'share', 'Paradox Interactive', 'Stellaris', 'save games'), {
		recursive: true
	});

	it("finds Steam's libraries and the user folder in Documents", () => {
		const { games, users } = discover({ platform: 'darwin', home, env: {}, reg: () => null });
		expect(games).toEqual([{ dir: game, source: 'Steam', version: 'v4.5.2' }]);
		expect(users.map((u) => [u.dir, u.source, u.saves])).toEqual([[user, 'macOS', 1]]);
	});
});
