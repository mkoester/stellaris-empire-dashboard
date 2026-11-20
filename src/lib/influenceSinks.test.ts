import { describe, expect, it } from 'vitest';
import { SINKS, sinkFacts, sinkRows, type SinkFacts } from './influenceSinks.ts';
import type { Snapshot } from './types.ts';

const facts = (f: Partial<SinkFacts> = {}): SinkFacts => ({
	nomad: false,
	megacorp: false,
	origin: 'origin_default',
	civics: [],
	perks: [],
	techs: new Set(),
	flags: [],
	situations: [],
	partners: 0,
	commercialPacts: 0,
	primitives: 0,
	galcom: { formed: false, member: false, council: false, nominating: false },
	subjects: 0,
	overlord: false,
	specialist: false,
	colonies: 1,
	envoysFree: 2,
	...f
});
const ids = (f: SinkFacts) => sinkRows(f).map((r) => r.id);
const row = (f: SinkFacts, id: string) => sinkRows(f).find((r) => r.id === id);

describe('sinkRows', () => {
	it('hides what a nomad never uses, and what a settled empire never uses', () => {
		const nomad = ids(facts({ nomad: true }));
		expect(nomad).toContain('waystation');
		expect(nomad).toContain('hyper-relay'); // at a waystation
		expect(nomad).not.toContain('outpost');
		expect(nomad).not.toContain('claim');
		expect(nomad).not.toContain('ring-world');
		const settled = ids(facts());
		expect(settled).toContain('outpost');
		expect(settled).not.toContain('waystation');
		expect(settled).not.toContain('arkship-2');
	});

	it('hides what needs an origin, civic or authority the empire lacks', () => {
		const plain = ids(facts());
		for (const id of [
			'branch-office',
			'knights-habitat',
			'wilderness',
			'deep-sleep',
			'inner-focus'
		])
			expect(plain).not.toContain(id);
		expect(ids(facts({ megacorp: true }))).toContain('branch-office');
		expect(ids(facts({ origin: 'origin_wilderness' }))).toContain('wilderness');
	});

	it('greys out what is not available yet, saying why', () => {
		const f = facts({ nomad: true });
		expect(row(f, 'waystation')?.blocked).toBeNull();
		expect(row(f, 'arkship-2')?.blocked).toBe('needs Arkship Engineering');
		expect(
			row(facts({ nomad: true, techs: new Set(['tech_arkship_tier_2']) }), 'arkship-2')?.blocked
		).toBeNull();
		expect(row(f, 'pacts')?.blocked).toMatch(/communications/);
		expect(row(facts({ partners: 1 }), 'pacts')?.blocked).toBeNull();
		expect(row(facts({ partners: 1, envoysFree: 0 }), 'envoy-relations')?.blocked).toBe(
			'no free envoy'
		);
	});

	it('follows the Galactic Community from not founded to member and council', () => {
		expect(row(facts(), 'propose')?.blocked).toMatch(/not founded/);
		const outside = facts({
			galcom: { formed: true, member: false, council: false, nominating: false }
		});
		expect(row(outside, 'join')?.blocked).toBeNull();
		expect(row(outside, 'propose')?.blocked).toMatch(/not a member/);
		expect(ids(outside)).not.toContain('leave');
		const inside = facts({
			galcom: { formed: true, member: true, council: false, nominating: false }
		});
		expect(ids(inside)).not.toContain('join');
		expect(row(inside, 'propose')?.blocked).toBeNull();
		expect(row(inside, 'freeze')?.blocked).toBe('no Galactic Council yet');
	});

	it('names every sink once', () => {
		expect(new Set(SINKS.map((s) => s.id)).size).toBe(SINKS.length);
	});
});

describe('sinkFacts', () => {
	it('counts only regular empires we talk to as partners, and reads the rest', () => {
		const s = {
			situations: [{ type: 'situation_nomad_economy' }],
			government: ['auth_corporate', 'civic_x'],
			origin: 'origin_default',
			ascensionPerks: [],
			progress: { researched: ['tech_a'] },
			countryFlags: [],
			countries: [
				{ id: 1, type: 'default' },
				{ id: 2, type: 'fallen_empire' },
				{ id: 3, type: 'primitive' }
			],
			relations: [
				{ countryId: 1, communications: true, agreements: ['commercial_pact'] },
				{ countryId: 2, communications: true, agreements: [] },
				{ countryId: 3, communications: false, agreements: [] }
			],
			galcom: null,
			subjects: [{ weAreOverlord: false, specialistLevel: 1 }],
			colonies: [{}, {}],
			envoys: { used: 1, total: 3 }
		} as unknown as Snapshot;
		expect(sinkFacts(s)).toMatchObject({
			nomad: true,
			megacorp: true,
			partners: 1,
			commercialPacts: 1,
			primitives: 1,
			galcom: { formed: false, member: false },
			subjects: 0,
			overlord: true,
			specialist: true,
			colonies: 2,
			envoysFree: 2
		});
		expect(sinkFacts(s).techs.has('tech_a')).toBe(true);
	});
});
