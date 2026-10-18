import { describe, expect, it } from 'vitest';
import {
	dlcRows,
	modRows,
	parseModDescriptor,
	supports,
	trackedMods,
	versionChanges,
	withLauncher
} from './addons.ts';
import type { Dlc } from './types.ts';

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
			local: false
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
