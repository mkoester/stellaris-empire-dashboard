import { sideSummary } from './deals.ts';
import { nameOf, pretty } from './format.ts';
import { gameYear } from './series.ts';
import type { Colony, GameData, Snapshot } from './types.ts';

// Milestones: the bigger events of a campaign (a colony founded, a tradition taken, a war lost …),
// derived on read by comparing consecutive saves along the branch shown — so they follow the save
// graph and cover the whole history for every field the snapshots hold. A field is compared only
// between saves that both have it: a snapshot from before the field existed is "unknown", not
// "everything is new". An event is dated to the first save that shows it, so up to a month late
// with monthly autosaves. A new kind: add it to KINDS and a detector to DETECTORS.

export const KINDS = [
	{ kind: 'system', label: 'systems' },
	{ kind: 'colonization', label: 'colonization started' },
	{ kind: 'colony', label: 'colonies established' },
	{ kind: 'colony-gained', label: 'colonies gained (conquest, cession)' },
	{ kind: 'colony-lost', label: 'colonies lost' },
	{ kind: 'district', label: 'districts built' },
	{ kind: 'building', label: 'buildings done' },
	{ kind: 'war', label: 'wars' },
	{ kind: 'tradition-tree', label: 'tradition trees' },
	{ kind: 'tradition', label: 'traditions' },
	{ kind: 'perk', label: 'ascension perks' },
	{ kind: 'research', label: 'research' },
	{ kind: 'species', label: 'species' },
	{ kind: 'trade-deal', label: 'trade deals' },
	{ kind: 'agenda', label: 'agendas passed' },
	{ kind: 'leader', label: 'leaders' },
	{ kind: 'ruler', label: 'ruler' },
	{ kind: 'government', label: 'government: civics, ethics, authority, type, origin' },
	{ kind: 'policy', label: 'policies' },
	{ kind: 'edict', label: 'edicts' },
	{ kind: 'sector', label: 'sectors' }
] as const;
export type EventKind = (typeof KINDS)[number]['kind'];
export const KIND_IDS: readonly string[] = KINDS.map((k) => k.kind);

export type Milestone = {
	date: string;
	x: number; // fractional game year, as the charts' x axis
	kind: EventKind;
	label: string;
	planetId?: number; // colony events: the planet, so colony pages show only their own
};

type Names = Pick<
	GameData,
	'techs' | 'agendas' | 'edicts' | 'traditionTrees' | 'perks' | 'names' | 'identityNames'
>;
type Found = Omit<Milestone, 'date' | 'x'>;

const added = <T>(before: T[], after: T[]) => after.filter((x) => !before.includes(x));

/** Compare `get(s)` between consecutive saves that both have it (non-null). */
const field =
	<T>(get: (s: Snapshot) => T | null | undefined, diff: (a: T, b: T, names: Names) => Found[]) =>
	(snaps: Snapshot[], names: Names) => {
		const out: { s: Snapshot; found: Found[] }[] = [];
		let last: T | null = null;
		for (const s of snaps) {
			const v = get(s);
			if (v === null || v === undefined) continue;
			if (last !== null) out.push({ s, found: diff(last, v, names) });
			last = v;
		}
		return out;
	};

// Owned systems by name, from `knownSystems` only. Snapshots from before that field kept their
// starbases (`stations`), but read by a parser that saw only the capital's (the outpost bug):
// mixing the two made a save re-read later look like Alpha Centauri gained, then lost (2203.08).
const ownedSystems = (s: Snapshot): string[] | null =>
	s.knownSystems?.filter((k) => k.owned).map((k) => k.name) ?? null;

/** How often each key occurs: districts built per type, buildings per type. */
const tally = (keys: [string, number][]) => {
	const m = new Map<string, number>();
	for (const [k, n] of keys) m.set(k, (m.get(k) ?? 0) + n);
	return m;
};
const districtsOf = (c: Colony) => tally(c.districtList.map((d) => [d.type, d.built]));
const buildingsOf = (c: Colony) =>
	tally(
		c.districtList.flatMap((d) =>
			d.zones.flatMap((z) => z.buildings.map((b): [string, number] => [b, 1]))
		)
	);

/** What grew (+n) or shrank (−n) from one tally to the next. */
const changes = (a: Map<string, number>, b: Map<string, number>) =>
	[...new Set([...a.keys(), ...b.keys()])]
		.map((k) => [k, (b.get(k) ?? 0) - (a.get(k) ?? 0)] as const)
		.filter(([, d]) => d !== 0);

const trees = (names: Names) =>
	Object.values(names.traditionTrees).flatMap((t) =>
		t.traditions.map((tr) => ({ ...tr, tree: t.name }))
	);

const DETECTORS = [
	field(ownedSystems, (a, b) => [
		...added(a, b).map((n) => ({ kind: 'system' as const, label: `system gained: ${n}` })),
		...added(b, a).map((n) => ({ kind: 'system' as const, label: `system lost: ${n}` }))
	]),
	field(
		// no colonies at all only where a snapshot does not know them (an empire without any is gone)
		(s) => (s.colonies.length ? s.colonies.filter((c) => c.planetId >= 0) : null),
		(a, b) => {
			const was = new Map(a.map((c) => [c.planetId, c]));
			const now = new Set(b.map((c) => c.planetId));
			return [
				...b.flatMap((c): Found[] => {
					const before = was.get(c.planetId);
					const at = { planetId: c.planetId };
					if (!before)
						return [
							c.colonizing
								? { ...at, kind: 'colonization', label: `colonization started: ${c.name}` }
								: { ...at, kind: 'colony-gained', label: `colony gained: ${c.name}` }
						];
					return before.colonizing && !c.colonizing
						? [{ ...at, kind: 'colony', label: `colony established: ${c.name}` }]
						: [];
				}),
				...a
					.filter((c) => !now.has(c.planetId))
					.map((c) => ({
						planetId: c.planetId,
						kind: 'colony-lost' as const,
						label: `colony lost: ${c.name}`
					}))
			];
		}
	),
	// Districts and buildings per colony. Snapshots from before districts were read hold none on any
	// colony: unknown. A colony new in the save is skipped (its founding is its own event).
	field(
		(s) => (s.colonies.some((c) => c.districtList.length) ? s.colonies : null),
		(a, b, names) =>
			b.flatMap((c) => {
				const before = a.find((o) => o.planetId === c.planetId);
				if (!before || c.planetId < 0) return [];
				const at = { planetId: c.planetId };
				const n = (d: number) => (Math.abs(d) > 1 ? ` ×${Math.abs(d)}` : '');
				return [
					...changes(districtsOf(before), districtsOf(c)).map(([k, d]) => ({
						...at,
						kind: 'district' as const,
						label: `${d > 0 ? 'district built' : 'district removed'}: ${nameOf(names.names, k)}${n(d)} — ${c.name}`
					})),
					...changes(buildingsOf(before), buildingsOf(c)).map(([k, d]) => ({
						...at,
						kind: 'building' as const,
						label: `${d > 0 ? 'building done' : 'building removed'}: ${nameOf(names.names, k)}${n(d)} — ${c.name}`
					}))
				];
			})
	),
	field(
		(s) => s.wars,
		(a, b) => [
			...b
				.filter((w) => !a.some((o) => o.id === w.id))
				.map((w) => ({
					kind: 'war' as const,
					label: `war started: ${w.name}${w.enemies.length ? ` (vs ${w.enemies.join(', ')})` : ''}`
				})),
			...a
				.filter((w) => !b.some((o) => o.id === w.id))
				.map((w) => ({ kind: 'war' as const, label: `war ended: ${w.name}` }))
		]
	),
	field(
		(s) => s.warLostDate,
		(a, b) => (a !== b ? [{ kind: 'war' as const, label: 'war lost' }] : [])
	),
	field(
		(s) => s.traditions,
		(a, b, names) => {
			const all = trees(names);
			return added(a, b).map((key) => {
				const t = all.find((x) => x.key === key);
				const name = t?.name ?? pretty(key.replace(/^tr_/, ''));
				return t?.role === 'adopt'
					? { kind: 'tradition-tree' as const, label: `tradition tree adopted: ${t.tree}` }
					: t?.role === 'finish'
						? { kind: 'tradition-tree' as const, label: `tradition tree finished: ${t.tree}` }
						: { kind: 'tradition' as const, label: `tradition: ${name}` };
			});
		}
	),
	field(
		(s) => s.ascensionPerks,
		(a, b, names) =>
			added(a, b).map((k) => ({
				kind: 'perk' as const,
				label: `ascension perk: ${names.perks[k] ?? pretty(k)}`
			}))
	),
	field(
		(s) => s.progress?.researched,
		(a, b, names) =>
			added(a, b).map((k) => ({
				kind: 'research' as const,
				label: `researched: ${names.techs[k]?.name ?? pretty(k)}`
			}))
	),
	field(
		(s) => s.species,
		(a, b) =>
			b.flatMap((sp): Found[] => {
				const before = a.find((o) => o.id === sp.id);
				if (!before) return [{ kind: 'species', label: `new species: ${sp.name}` }];
				const traits = added(before.traits, sp.traits).concat(
					added(sp.traits, before.traits).map((t) => `−${t}`)
				);
				return traits.length
					? [
							{
								kind: 'species',
								label: `species modified: ${sp.name} (${traits.map((t) => pretty(t.replace(/trait_/, ''))).join(', ')})`
							}
						]
					: [];
			})
	),
	field(
		(s) => s.tradeDeals,
		(a, b) => [
			...b
				.filter((d) => !a.some((o) => o.id === d.id))
				.map((d) => ({
					kind: 'trade-deal' as const,
					label: `trade deal with ${d.partner}: we give ${sideSummary(d.gives)}, get ${sideSummary(d.gets)}`
				})),
			...a
				.filter((d) => !b.some((o) => o.id === d.id))
				.map((d) => ({ kind: 'trade-deal' as const, label: `trade deal ended: ${d.partner}` }))
		]
	),
	field(
		(s) => s.agendasDone,
		(a, b, names) =>
			added(a, b).map((k) => ({
				kind: 'agenda' as const,
				label: `agenda passed: ${names.agendas[k]?.name ?? pretty(k)}`
			}))
	),
	field(
		(s) => s.leaderRoster,
		(a, b) => [
			...b
				.filter((l) => !a.some((o) => o.id === l.id))
				.map((l) => ({ kind: 'leader' as const, label: `new ${l.class}: ${l.name}` })),
			...a
				.filter((l) => !b.some((o) => o.id === l.id))
				.map((l) => ({ kind: 'leader' as const, label: `${l.class} gone: ${l.name}` }))
		]
	),
	field(
		(s) => s.ruler,
		(a, b) => (a.id !== b.id ? [{ kind: 'ruler' as const, label: `new ruler: ${b.name}` }] : [])
	),
	field(
		(s) => s.government,
		(a, b, names) => [
			...added(a, b).map((k) => ({
				kind: 'government' as const,
				label: `+ ${nameOf(names.identityNames, k)}`
			})),
			...added(b, a).map((k) => ({
				kind: 'government' as const,
				label: `− ${nameOf(names.identityNames, k)}`
			}))
		]
	),
	...(['governmentType', 'origin'] as const).map((f) =>
		field(
			(s) => s[f],
			(a, b, names) =>
				a !== b
					? [
							{
								kind: 'government' as const,
								label: `${f === 'origin' ? 'origin' : 'government'}: ${nameOf(names.identityNames, a)} → ${nameOf(names.identityNames, b)}`
							}
						]
					: []
		)
	),
	field(
		(s) => s.policies,
		(a, b) =>
			Object.entries(b)
				.filter(([p, v]) => p in a && a[p] !== v)
				.map(([p, v]) => ({ kind: 'policy' as const, label: `${pretty(p)}: ${pretty(v)}` }))
	),
	field(
		(s) => s.edicts,
		(a, b, names) => [
			...added(a, b).map((k) => ({
				kind: 'edict' as const,
				label: `edict on: ${names.edicts[k]?.name ?? pretty(k)}`
			})),
			...added(b, a).map((k) => ({
				kind: 'edict' as const,
				label: `edict off: ${names.edicts[k]?.name ?? pretty(k)}`
			}))
		]
	),
	field(
		(s) => s.sectors?.map((x) => x.name),
		(a, b) => added(a, b).map((n) => ({ kind: 'sector' as const, label: `new sector: ${n}` }))
	)
] satisfies ((snaps: Snapshot[], names: Names) => { s: Snapshot; found: Found[] }[])[];

/** The branch's milestones, oldest first; `snaps` is the branch from its root to its tip. */
export function milestones(snaps: Snapshot[], names: Names): Milestone[] {
	const saves = snaps.filter((s) => s.kind === 'save');
	return DETECTORS.flatMap((detect) =>
		detect(saves, names).flatMap(({ s, found }) =>
			found.map((f) => ({ ...f, date: s.date, x: gameYear(s.date) }))
		)
	).sort((a, b) => a.x - b.x);
}
