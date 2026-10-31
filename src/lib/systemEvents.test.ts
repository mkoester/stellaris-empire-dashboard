import { describe, expect, it } from 'vitest';
import {
	entryDetail,
	entryEventsFor,
	entryLabel,
	firstEntries,
	type EntryEvent,
	type SystemEntry
} from './systemEvents.ts';

const ev = (
	id: string,
	flags: string[],
	o: { not?: string[]; any?: string[]; title?: string; once?: string } = {}
): EntryEvent => ({
	id,
	title: o.title ?? id,
	description: null,
	flags,
	anyFlags: o.any ?? [],
	notFlags: o.not ?? [],
	onceFlag: o.once ?? null
});

// 4.5.3's system_entry_event rows
const hive = ev('leviathans.3202', ['guardians_hive_system'], { not: ['hivers_defeated'] });
const tunnel = ev('enclave.100', [], { any: ['shroud_tunnel_nexus', 'shroud_tunnel_node'] });
// Helito: before and after the Solarpunks are revealed, one title
const orbitals = ev('fircon.5000', ['solarpunk_system_01'], {
	not: ['solarpunk_system_revealed'],
	title: 'Missing Orbitals',
	once: 'found_helito'
});
const orbitals2 = ev('fircon.5005', ['solarpunk_system_01', 'solarpunk_system_revealed'], {
	title: 'Missing Orbitals'
});

describe('system entry events', () => {
	it('matches a system by its flags: all its own, one of the alternatives, none forbidden', () => {
		// Bir, 2205.09.18: its star flags
		const bir = ['guardians_hive_system', 'guardian', 'hostile_system', 'antique_threat_system'];
		expect(entryEventsFor(bir, [hive, tunnel]).map((e) => e.id)).toEqual(['leviathans.3202']);
		expect(entryEventsFor([...bir, 'hivers_defeated'], [hive])).toEqual([]);
		expect(entryEventsFor(['shroud_tunnel_node'], [hive, tunnel])).toEqual([tunnel]);
		expect(entryEventsFor([], [hive, tunnel])).toEqual([]);
		expect(entryEventsFor(['solarpunk_system_01'], [orbitals, orbitals2])).toEqual([orbitals]);
		expect(
			entryEventsFor(['solarpunk_system_01', 'solarpunk_system_revealed'], [orbitals, orbitals2])
		).toEqual([orbitals2]);
	});

	it('labels an entry by its system and titles, a chain’s once', () => {
		const pop = (id: string) => ({ id, title: 'Missing Orbitals' });
		expect(entryLabel({ system: 'Helito', events: [pop('fircon.5000'), pop('fircon.5005')] })).toBe(
			'Helito: Missing Orbitals'
		);
	});

	describe('firstEntries', () => {
		const gate = (systemId: number, system: string): SystemEntry => ({
			systemId,
			system,
			events: [{ id: 'apoc.1', title: 'Abandoned Gateway', once: 'encountered_first_gateway' }]
		});
		const bir: SystemEntry = {
			systemId: 61,
			system: 'Bir',
			events: [{ id: 'leviathans.3202', title: 'Crystalline Asteroids' }]
		};

		it('shows a once-per-empire popup only where its flag turned from unset to set', () => {
			// the nomad game: Urakhannon's Maw entered while the flag stayed unset (no popup there),
			// Acamar after it appeared — between them, saves of an older reader without entries
			const maw = gate(1, "Urakhannon's Maw");
			const flag = ['encountered_first_gateway'];
			const r = firstEntries([
				{ entries: [maw], flags: [] }, // 2204.01.01
				{ entries: null, flags: flag }, // 2205.05.01, read before entries were
				{ entries: [maw, gate(2, 'Acamar')], flags: flag }, // 2205.07.21
				{ entries: [maw, gate(2, 'Acamar'), gate(3, 'Achernar'), bir], flags: flag } // 2205.09.18
			]);
			expect(r.map((e) => [e.at, entryLabel(e)])).toEqual([
				[2, 'Acamar: Abandoned Gateway'],
				[3, 'Bir: Crystalline Asteroids']
			]);
		});

		it('takes a first listing with the flag set as the popup, flags of older readings aside', () => {
			const r = firstEntries([
				{ entries: null, flags: ['encountered_first_gateway'] },
				{ entries: [gate(1, "Urakhannon's Maw")], flags: ['encountered_first_gateway'] }
			]);
			expect(r.map(entryLabel)).toEqual(["Urakhannon's Maw: Abandoned Gateway"]);
		});

		it('says "one of N" where several systems entered between two saves share it', () => {
			const r = firstEntries([
				{ entries: [], flags: [] },
				{ entries: [gate(2, 'Acamar'), gate(3, 'Elissa')], flags: ['encountered_first_gateway'] }
			]);
			expect(r.map(entryLabel)).toEqual([
				'Acamar: Abandoned Gateway (one of 2 systems)',
				'Elissa: Abandoned Gateway (one of 2 systems)'
			]);
		});

		it('keeps a system at its first reading, though its flags change after', () => {
			const helito = (id: string): SystemEntry => ({
				systemId: 9,
				system: 'Helito',
				events: [{ id, title: 'Missing Orbitals', once: 'found_helito' }]
			});
			const r = firstEntries([
				{ entries: null, flags: null }, // a month only the log saw
				{ entries: [], flags: [] },
				{ entries: [helito('fircon.5000')], flags: ['found_helito'] },
				{ entries: [helito('fircon.5005')], flags: ['found_helito'] }
			]);
			expect(r).toEqual([{ ...helito('fircon.5000'), at: 2 }]);
		});
	});

	it('shortens a popup to its first sentence for the map', () => {
		expect(
			entryDetail(
				'The … system is home to an unusually dense asteroid belt.\n\nHowever, long-range sensors …'
			)
		).toBe('on first entry: The … system is home to an unusually dense asteroid belt.');
		expect(entryDetail(null)).toBe('on first entry');
		expect(entryDetail('x'.repeat(200)).length).toBe('on first entry: '.length + 140);
	});
});
