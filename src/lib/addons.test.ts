import { describe, expect, it } from 'vitest';
import {
	ageDays,
	ageLabel,
	campaignModSet,
	dataModFolders,
	dataModMismatch,
	dlcRows,
	loadOrder,
	modRows,
	parseModDescriptor,
	supports,
	trackedMods,
	versionChanges,
	withLauncher
} from './addons.ts';
import type { Dlc, ModInfo } from './types.ts';

const dlc = (name: string, category: string | null): Dlc => ({
	name,
	key: '',
	category,
	releaseDate: null,
	gameplay: true,
	baseGame: false
});

describe('dlcRows', () => {
	it('marks what the save has active and adds DLCs the data DB does not know', () => {
		const rows = dlcRows(
			[dlc('Utopia', 'expansion'), dlc('Megacorp', 'expansion')],
			['Utopia', 'Some Future Pack']
		);
		expect(rows.map((r) => [r.name, r.active])).toEqual([
			['Utopia', true],
			['Megacorp', false],
			['Some Future Pack', true]
		]);
	});

	it('leaves the state unknown without a save', () => {
		expect(dlcRows([dlc('Utopia', 'expansion')], null)[0].active).toBeNull();
	});
});

describe('supports', () => {
	it('matches part by part with * for the rest', () => {
		expect(supports('v4.5.*', 'Cygnus v4.5.2')).toBe(true);
		expect(supports('4.5.2', 'Cygnus v4.5.2')).toBe(true);
		expect(supports('*', 'Cygnus v4.5.2')).toBe(true);
		expect(supports('v4.4.*', 'Cygnus v4.5.2')).toBe(false);
		expect(supports('3.0.1', 'Cygnus v4.5.2')).toBe(false);
	});

	it('is unknown without either version', () => {
		expect(supports(null, 'Cygnus v4.5.2')).toBeNull();
		expect(supports('v4.5.*', null)).toBeNull();
	});
});

describe('parseModDescriptor', () => {
	// ugc_1381214767.mod, as the launcher writes it (no newline at the end)
	const text =
		'name="Colored Map Icons"\ntags={\n\t"Graphics"\n}\npicture="thumbnail.png"\nsupported_version="v4.5.*"\npath="S:/steamapps/workshop/content/281990/1381214767"\nremote_file_id="1381214767"';

	it('reads name, tags, supported version and the workshop id', () => {
		expect(parseModDescriptor(text, 'ugc_1381214767.mod')).toEqual({
			name: 'Colored Map Icons',
			version: null,
			supportedVersion: 'v4.5.*',
			tags: ['Graphics'],
			steamId: '1381214767',
			updated: null,
			file: 'ugc_1381214767.mod',
			local: false,
			path: 'S:/steamapps/workshop/content/281990/1381214767'
		});
	});

	it('skips a descriptor without a name', () => {
		expect(parseModDescriptor('tags={ "UI" }', 'x.mod')).toBeNull();
	});

	// 2026-10-18: fc_meaningful_labels.mod (link-mod-proton.sh) beside its ugc_3741592450.mod
	it('tells a dev copy from its published version by the file', () => {
		const d = 'name="First Contact: Meaningful Labels"\nremote_file_id="3741592450"';
		const local = parseModDescriptor(d, 'fc_meaningful_labels.mod')!;
		const workshop = parseModDescriptor(d, 'ugc_3741592450.mod')!;
		expect([local.local, workshop.local]).toEqual([true, false]);
		expect(local.file).not.toBe(workshop.file);
		expect(trackedMods([local, workshop])).toEqual([workshop]);
	});
});

describe('modRows', () => {
	it('lists installed mods and active ones without a descriptor', () => {
		const installed = parseModDescriptor('name="A"\nsupported_version="v4.4.*"', 'a.mod')!;
		const rows = modRows([installed], ['A', 'B'], 'Cygnus v4.5.2');
		expect(rows.map((r) => [r.name, r.active, r.supported])).toEqual([
			['A', true, false],
			['B', true, null]
		]);
	});

	it("numbers mods by the launcher's load order, disabled ones none", () => {
		const a = parseModDescriptor('name="A"', 'ugc_1.mod')!;
		const b = parseModDescriptor('name="B"', 'ugc_2.mod')!;
		const c = parseModDescriptor('name="C"', 'local.mod')!;
		// dlc_load.json as the launcher writes it (2026-10-31)
		const order = loadOrder(
			'{"enabled_mods":["mod/ugc_2.mod","mod/ugc_1.mod"],"disabled_dlcs":[]}'
		);
		expect(order).toEqual(['ugc_2.mod', 'ugc_1.mod']);
		expect(modRows([a, b, c], null, null, order).map((r) => [r.name, r.order])).toEqual([
			['A', 2],
			['B', 1],
			['C', null]
		]);
		expect(loadOrder('not json')).toEqual([]);
	});

	it('of a local copy and its Workshop twin, takes the one the launcher loaded as active', () => {
		// 2026-10-31: dashboard_feed.mod in the playset, ugc_3826360023.mod only subscribed
		const local = parseModDescriptor('name="Empire Dashboard Feed"', 'dashboard_feed.mod')!;
		const workshop = parseModDescriptor('name="Empire Dashboard Feed"', 'ugc_3826360023.mod')!;
		const rows = modRows([local, workshop], ['Empire Dashboard Feed'], null, [
			'dashboard_feed.mod'
		]);
		expect(rows.map((r) => [r.file, r.active, r.order])).toEqual([
			['dashboard_feed.mod', true, 1],
			['ugc_3826360023.mod', false, null]
		]);
		// without a load order both stay active: the save cannot tell them apart
		expect(
			modRows([local, workshop], ['Empire Dashboard Feed'], null).map((r) => r.active)
		).toEqual([true, true]);
	});
});

describe('withLauncher', () => {
	it('takes the launcher’s update time, and its version where the descriptor has none', () => {
		const m = parseModDescriptor(
			'name="Colored Map Icons"\nremote_file_id="1381214767"',
			'ugc_1381214767.mod'
		)!;
		// launcher-v2.sqlite mods row for 1381214767 (timeUpdated in seconds)
		const [out] = withLauncher(
			[m],
			[{ steamId: '1381214767', version: '2.1', timeUpdated: 1791390559 }]
		);
		expect(out.version).toBe('2.1');
		expect(out.updated).toBe(new Date(1791390559 * 1000).toISOString());
	});
});

describe('versionChanges', () => {
	const seen = (
		name: string,
		version: string | null,
		seenAt: string,
		updated: string | null = null
	) => ({
		name,
		version,
		supportedVersion: 'v4.5.*',
		updated,
		seenAt,
		gameDate: null
	});

	it('reports changes between sightings, not the first sighting', () => {
		const changes = versionChanges([
			seen('A', '1.0', '2026-10-18T10:00'),
			seen('B', null, '2026-10-18T10:00', 'u1'),
			seen('A', '1.0', '2026-10-19T10:00'),
			seen('B', null, '2026-10-19T10:00', 'u2'),
			seen('A', '1.1', '2026-10-20T10:00')
		]);
		expect(changes.map((c) => [c.name, c.from.version, c.to.version, c.to.seenAt])).toEqual([
			['A', '1.0', '1.1', '2026-10-20T10:00'],
			['B', null, null, '2026-10-19T10:00']
		]);
	});
});

describe('mod age', () => {
	it('counts whole days since the update and shortens them', () => {
		const now = Date.parse('2026-10-31T12:00:00Z');
		expect(ageDays('2026-10-30T13:00:00Z', now)).toBe(0);
		expect(ageDays('2026-10-01T12:00:00Z', now)).toBe(30);
		expect(ageDays(null, now)).toBeNull();
		expect([5, 59, 60, 400, 729, 913].map(ageLabel)).toEqual([
			'5 d',
			'59 d',
			'2 mo',
			'13 mo',
			'24 mo',
			'2.5 y'
		]);
	});
});

describe('dataModFolders', () => {
	const mod = (name: string, file: string, path: string | null): ModInfo => ({
		name,
		version: null,
		supportedVersion: null,
		tags: [],
		steamId: null,
		updated: '2026-11-01T00:00:00.000Z',
		file,
		local: false,
		path
	});

	it('follows the load order and skips mods without a folder', () => {
		const ds = [
			mod('A', 'ugc_1.mod', '/w/1'),
			mod('B', 'ugc_2.mod', '/w/2'),
			mod('Z', 'z.mod', null)
		];
		expect(dataModFolders(ds, ['ugc_2.mod', 'z.mod', 'gone.mod', 'ugc_1.mod'])).toEqual([
			{ name: 'B', path: '/w/2', updated: '2026-11-01T00:00:00.000Z' },
			{ name: 'A', path: '/w/1', updated: '2026-11-01T00:00:00.000Z' }
		]);
	});
});

describe('campaignModSet', () => {
	const mod = (name: string, file: string, path: string | null = `/w/${file}`): ModInfo => ({
		name,
		version: null,
		supportedVersion: null,
		tags: [],
		steamId: null,
		updated: null,
		file,
		local: !file.startsWith('ugc_'),
		path
	});
	const ds = [
		mod('A', 'ugc_1.mod'),
		mod('B', 'ugc_2.mod'),
		mod('C', 'ugc_3.mod'),
		mod('C', 'c_dev.mod'), // a dev copy of C, registered next to its subscription
		mod('Zip', 'ugc_9.mod', null)
	];
	const names = (r: ReturnType<typeof campaignModSet>) => r.mods.map((m) => m.path);

	it("takes the launch order when it holds exactly the save's mods", () => {
		const r = campaignModSet(['A', 'B'], ds, ['ugc_2.mod', 'ugc_1.mod'], []);
		expect(r.source).toEqual({ kind: 'launch' });
		expect(names(r)).toEqual(['/w/ugc_2.mod', '/w/ugc_1.mod']);
	});

	it('else a playset holding exactly them, the active one first', () => {
		const playsets = [
			{ name: 'other', active: false, order: ['ugc_1.mod', 'ugc_3.mod'] },
			{ name: 'mine', active: true, order: ['ugc_3.mod', 'ugc_1.mod'] },
			{ name: 'more', active: false, order: ['ugc_1.mod', 'ugc_2.mod', 'ugc_3.mod'] }
		];
		const r = campaignModSet(['A', 'C'], ds, ['ugc_1.mod'], playsets);
		expect(r.source).toEqual({ kind: 'playset', name: 'mine', exact: true });
		expect(names(r)).toEqual(['/w/ugc_3.mod', '/w/ugc_1.mod']);
	});

	it('else the closest playset: most of the mods, fewest others; the rest appended', () => {
		const playsets = [
			{ name: 'wide', active: true, order: ['ugc_2.mod', 'ugc_9.mod', 'ugc_3.mod', 'ugc_1.mod'] },
			{ name: 'narrow', active: false, order: ['ugc_3.mod', 'x.mod', 'ugc_1.mod'] },
			{ name: 'half', active: false, order: ['ugc_1.mod'] }
		];
		// both hold A and C; `narrow` has one other mod, `wide` two
		const r = campaignModSet(['A', 'B', 'C'], ds, [], playsets.slice(1));
		expect(r.source).toEqual({ kind: 'playset', name: 'narrow', exact: false });
		expect(names(r)).toEqual(['/w/ugc_3.mod', '/w/ugc_1.mod', '/w/ugc_2.mod']); // B appended
		const all = campaignModSet(['A', 'B', 'C'], ds, [], playsets);
		expect(all.source).toEqual({ kind: 'playset', name: 'wide', exact: false }); // holds all three
		expect(names(all)).toEqual(['/w/ugc_2.mod', '/w/ugc_3.mod', '/w/ugc_1.mod']);
	});

	it('else alphabetical, the copy the launcher loaded last for a doubled name', () => {
		const r = campaignModSet(['C', 'A', 'Zip', 'Gone'], ds, ['c_dev.mod'], []);
		expect(r.source).toEqual({ kind: 'guessed' });
		expect(names(r)).toEqual(['/w/ugc_1.mod', '/w/c_dev.mod']);
		expect(r.missing).toEqual(['Zip', 'Gone']);
	});

	it('no save yet: the launch order; no mods: none', () => {
		expect(names(campaignModSet(null, ds, ['ugc_1.mod'], []))).toEqual(['/w/ugc_1.mod']);
		expect(campaignModSet(null, ds, [], [])).toEqual({ mods: [], source: null, missing: [] });
		expect(campaignModSet([], ds, ['ugc_1.mod'], [])).toEqual({
			mods: [],
			source: null,
			missing: []
		});
	});
});

describe('dataModMismatch', () => {
	it('names the active mods the data lacks and the data mods not active', () => {
		expect(dataModMismatch(['A', 'B'], ['B', 'C'])).toEqual({ missing: ['C'], extra: ['A'] });
		expect(dataModMismatch(['A'], ['A'])).toEqual({ missing: [], extra: [] });
		expect(dataModMismatch(null, ['A'])).toBeNull();
	});
});
