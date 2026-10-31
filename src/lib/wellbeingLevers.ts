import { colonyActiveBuildings } from './buildings.ts';
import type { Colony, Explanation, Modifier, Snapshot } from './types.ts';

// What a colony could give up to lower its happiness or its amenities — for a colony above the
// stability cap, where both are spent for nothing (#lib/wellbeing.ts says how much). Every source
// the popups explain (`server/explain.ts`: buildings, jobs, designations, edicts, policies,
// traditions, civics, ethics, rights, static modifiers, …) that holds now and carries such a
// modifier; its other modifiers are what giving it up costs or brings besides. **Only the
// unconditional modifiers the data DB holds**: triggered ones (living standards' happiness, most
// job swaps) and leader traits are not among them. Pure.

export type LeverTarget = 'happiness' | 'amenities';

/** How the player changes a source: at once, slowly (a reform, an ethics shift) or not at all. */
export type How = 'now' | 'slow' | 'no';

export type Lever = {
	ref: string; // the popup, `<prefix>:<key>`
	local: boolean; // this colony's own (a building, a job, …) or empire-wide
	count: number; // how many of it hold: buildings on the colony, a job's workers; else 1
	effects: Modifier[]; // the modifiers that raise the target
	side: Modifier[]; // everything else it does
	how: How;
	change: string;
};

/** Which target a modifier raises, so that giving it up lowers it; null for any other. */
export function raises(m: Pick<Modifier, 'key' | 'value'>, gestalt: boolean): LeverTarget | null {
	const k = m.key;
	const up = m.value > 0;
	if (gestalt) {
		if (/^planet_amenities_no_happiness_(add|mult)$/.test(k)) return up ? 'amenities' : null;
		if (/^pop_amenities_usage_no_happiness_mult$/.test(k)) return up ? null : 'amenities';
		return null;
	}
	if (/happiness/.test(k) && !/no_happiness/.test(k))
		return /happiness$/.test(k) && up ? 'happiness' : null;
	if (/^planet_amenities_(add|mult)$/.test(k) || k === 'pop_job_amenities_mult')
		return up ? 'amenities' : null;
	// a lower need raises the ratio: giving up a cut in usage lowers it
	if (/^pop_amenities_usage(_\w+)?_(add|mult)$/.test(k)) return up ? null : 'amenities';
	return null;
}

/** What holds now, by popup prefix: key → count. */
export type Held = {
	local: Record<string, Map<string, number>>;
	empire: Record<string, Map<string, number>>;
};

const counted = (keys: string[]) =>
	keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());

export function heldOf(s: Snapshot, c: Colony): Held {
	const gov = s.government ?? [];
	const of = (prefix: string) => counted(gov.filter((k) => k.startsWith(prefix)));
	return {
		local: {
			building: counted(colonyActiveBuildings(c.districtList)),
			designation: counted([c.designation]),
			job: new Map(c.jobs.filter((j) => j.filled > 0).map((j) => [j.type, j.filled])),
			deposit: counted([...new Set(c.deposits)]),
			modifier: counted((c.planet?.modifiers ?? []).map((m) => m.key))
		},
		empire: {
			tradition: counted(s.traditions ?? []),
			perk: counted(s.ascensionPerks ?? []),
			edict: counted(s.edicts ?? []),
			policy: counted(Object.values(s.policies ?? {})),
			civic: counted(gov.filter((k) => !/^(ethic|auth)_/.test(k))),
			ethic: of('ethic_'),
			authority: of('auth_'),
			origin: counted(s.origin ? [s.origin] : []),
			seat: counted((s.council ?? []).map((x) => x.type)),
			right: counted([
				...new Set(Object.values(s.speciesRights ?? {}).flatMap((r) => Object.values(r)))
			]),
			tech: counted(s.progress?.researched ?? []),
			trait: counted([
				...new Set((s.species ?? []).filter((x) => x.pops > 0).flatMap((x) => x.traits))
			]),
			modifier: counted((s.countryModifiers ?? []).map((m) => m.key))
		}
	};
}

const CHANGE: Record<string, [How, string]> = {
	building: ['now', 'demolish or disable it'],
	designation: ['now', 'change the designation'],
	job: [
		'now',
		'fewer workers: lower the job’s priority, or fewer of the buildings or districts that make it'
	],
	deposit: ['no', 'a planet feature'],
	edict: ['now', 'cancel the edict'],
	policy: ['now', 'pick another option'],
	right: ['now', 'change the species right'],
	civic: ['slow', 'reform the government'],
	authority: ['slow', 'reform the government'],
	seat: ['slow', 'reform the government (its civic)'],
	ethic: ['slow', 'shift the ethics'],
	trait: ['slow', 'gene modding'],
	tradition: ['no', 'adopted for good'],
	perk: ['no', 'adopted for good'],
	tech: ['no', 'researched'],
	origin: ['no', 'the origin'],
	modifier: ['no', 'an event, situation or timer']
};
const ORDER: Record<How, number> = { now: 0, slow: 1, no: 2 };

/** The sources that hold and raise each target, the ones the player can change now first. */
export function wellbeingLevers(
	explanations: Record<string, Explanation>,
	held: Held,
	gestalt: boolean
): Record<LeverTarget, Lever[]> {
	const out: Record<LeverTarget, Lever[]> = { happiness: [], amenities: [] };
	for (const [ref, e] of Object.entries(explanations)) {
		const i = ref.indexOf(':');
		const prefix = ref.slice(0, i);
		const key = ref.slice(i + 1);
		const local = held.local[prefix]?.get(key);
		const count = local ?? held.empire[prefix]?.get(key);
		if (!count || !CHANGE[prefix]) continue;
		for (const target of ['happiness', 'amenities'] as const) {
			const effects = e.modifiers.filter((m) => raises(m, gestalt) === target);
			if (!effects.length) continue;
			// the capital's building goes only with the capital
			const [how, change] =
				prefix === 'building' && /capital/.test(key)
					? (['no', 'the capital’s building'] as [How, string])
					: CHANGE[prefix];
			out[target].push({
				ref,
				local: local !== undefined,
				count,
				effects,
				side: e.modifiers.filter((m) => !effects.includes(m)),
				how,
				change
			});
		}
	}
	for (const t of ['happiness', 'amenities'] as const)
		out[t].sort((a, b) => ORDER[a.how] - ORDER[b.how] || Number(b.local) - Number(a.local));
	return out;
}
