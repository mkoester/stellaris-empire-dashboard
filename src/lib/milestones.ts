import { sideSummary } from './deals.ts';
import { nameOf, pretty } from './format.ts';
import { addGameDays, gameYear } from './series.ts';
import type {
	Colony,
	GalacticCommunity,
	GameData,
	LogEvent,
	ResolutionVote,
	Snapshot
} from './types.ts';

// Milestones: the bigger events of a campaign (a colony founded, a tradition taken, a war lost …),
// derived on read by comparing consecutive saves along the branch shown — so they follow the save
// graph and cover the whole history for every field the snapshots hold. A field is compared only
// between saves that both have it: a snapshot from before the field existed is "unknown", not
// "everything is new". An event is dated to the first save that shows it, so up to a month late
// with monthly autosaves — unless the companion mod logged it (`Snapshot.logEvents`): then it takes
// the mod's exact date (`fromLog`). A new kind: add it to KINDS and a detector to DETECTORS.

export const KINDS = [
	{ kind: 'system', label: 'systems' },
	{ kind: 'colonization', label: 'colonization started' },
	{ kind: 'colony', label: 'colonies established' },
	{ kind: 'colony-gained', label: 'colonies gained (conquest, cession)' },
	{ kind: 'colony-lost', label: 'colonies lost' },
	{ kind: 'district', label: 'districts built' },
	{ kind: 'building', label: 'buildings done' },
	{ kind: 'war', label: 'wars' },
	{ kind: 'combat', label: 'space battles (companion mod)' },
	{ kind: 'tradition-tree', label: 'tradition trees' },
	{ kind: 'tradition', label: 'traditions' },
	{ kind: 'perk', label: 'ascension perks' },
	{ kind: 'research', label: 'research' },
	{ kind: 'species', label: 'species' },
	{ kind: 'trade-deal', label: 'trade deals' },
	{ kind: 'agenda', label: 'agendas passed' },
	{ kind: 'galcom', label: 'Galactic Community: proposals, votes, withdrawals' },
	{ kind: 'leader', label: 'leaders' },
	{ kind: 'ruler', label: 'ruler' },
	{ kind: 'government', label: 'government: civics, ethics, authority, type, origin' },
	{ kind: 'policy', label: 'policies' },
	{ kind: 'edict', label: 'edicts' },
	{ kind: 'sector', label: 'sectors' },
	{ kind: 'dlc', label: 'DLCs enabled / disabled' },
	{ kind: 'mod', label: 'mods enabled / disabled' }
] as const;
export type EventKind = (typeof KINDS)[number]['kind'];
export const KIND_IDS: readonly string[] = KINDS.map((k) => k.kind);

export type Milestone = {
	date: string;
	x: number; // fractional game year, as the charts' x axis
	kind: EventKind;
	label: string;
	planetId?: number; // colony events: the planet, so colony pages show only their own
	// Galactic Community events in parts, for the resolution's popup and the empire's colour:
	// "<action>: <resolution> (by <by>)"
	galcom?: { action: string; resolution: string; by?: string };
};

type Names = Pick<
	GameData,
	| 'techs'
	| 'agendas'
	| 'edicts'
	| 'traditionTrees'
	| 'perks'
	| 'names'
	| 'identityNames'
	| 'diploNames'
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
		(s) => (s.colonies.length ? s.colonies : null),
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
				if (!before) return [];
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
	// The Galactic Community, by its resolution ids. The save keeps no history: a proposal that
	// leaves the queue neither voted on nor passed was withdrawn (by its proposer, or the game);
	// passed and withdrawn only for resolutions the earlier save listed — older snapshots have no
	// `passed` list (before READER 13), which must not read as everything passing, nor a vote that
	// passed as failed: a resolution any save along the branch lists as passed has passed.
	(snaps: Snapshot[], names: Names) => {
		const passedEver = new Set(snaps.flatMap((s) => s.galcom?.passed.map((r) => r.id) ?? []));
		return field(
			(s) => s.galcom,
			(a, b, names) => {
				const name = (r: ResolutionVote) =>
					names.diploNames[r.type] ?? pretty(r.type.replace(/^resolution_/, ''));
				const queued = (g: GalacticCommunity) => [...(g.voting ? [g.voting] : []), ...g.proposed];
				const has = (list: ResolutionVote[], r: ResolutionVote) => list.some((x) => x.id === r.id);
				const found: Found[] = [];
				const say = (label: string) => found.push({ kind: 'galcom', label });
				const about = (action: string, r: ResolutionVote, by = false) =>
					found.push({
						kind: 'galcom',
						label: `${action}: ${name(r)}${by ? ` (by ${r.proposer})` : ''}`,
						galcom: { action, resolution: r.type, ...(by ? { by: r.proposer } : {}) }
					});
				if (a.member !== b.member)
					say(b.member ? 'we joined the Galactic Community' : 'we left the Galactic Community');
				for (const r of queued(b))
					if (!has(queued(a), r) && !has(a.passed, r)) about('resolution proposed', r, true);
				if (b.voting && b.voting.id !== a.voting?.id) about('put to the vote', b.voting);
				for (const r of queued(a)) {
					if (has(queued(b), r)) continue;
					if (has(b.passed, r) || passedEver.has(r.id)) about('resolution passed', r);
					else if (a.voting?.id === r.id) about('resolution failed', r);
					else about('resolution withdrawn', r, true);
				}
				return found;
			}
		)(snaps, names);
	},
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
	),
	...(['dlc', 'mod'] as const).map((kind) =>
		field(
			(s) => (kind === 'dlc' ? s.dlcs : s.mods),
			(a, b) => [
				...added(a, b).map((n) => ({ kind, label: `${kind} enabled: ${n}` })),
				...added(b, a).map((n) => ({ kind, label: `${kind} disabled: ${n}` }))
			]
		)
	)
] satisfies ((snaps: Snapshot[], names: Names) => { s: Snapshot; found: Found[] }[])[];

/**
 * A mod event as the milestone it re-dates: its kind, the text a diffed label of that kind must
 * contain to be the same event, and the label to show when no save shows it.
 */
function fromLog(e: LogEvent): { kind: EventKind; match: string | null; label: string } | null {
	const [a, b, c, d, system] = e.fields;
	switch (e.kind) {
		case 'colony':
			return {
				kind: 'colony',
				match: `colony established: ${a}`,
				label: `colony established: ${a}`
			};
		case 'war-started':
			return { kind: 'war', match: `war started: ${a}`, label: `war started: ${a}` };
		case 'war-ended': // the war's name is not in the on_action's scopes
			return { kind: 'war', match: 'war ended: ', label: `war ended: ${b} won, ${a} lost` };
		case 'leader-died':
			return { kind: 'leader', match: ` gone: ${a}`, label: `leader died: ${a}` };
		case 'ruler':
			return { kind: 'ruler', match: `new ruler: ${a}`, label: `new ruler: ${a}` };
		case 'combat':
			return {
				kind: 'combat',
				match: null, // no save diff to match
				label: `battle at ${system}: ${a} (${b}) beat ${c} (${d})`
			};
		default: // spending, shown on the resources tab
			return null;
	}
}

/** How far after a mod event the first save showing it may be: a month, and some slack. */
const LOG_WINDOW_DAYS = 45;

/** The branch's milestones, oldest first; `snaps` is the branch from its root to its tip. */
export function milestones(snaps: Snapshot[], names: Names): Milestone[] {
	const saves = snaps.filter((s) => s.kind === 'save');
	const diffed: Milestone[] = DETECTORS.flatMap((detect) =>
		detect(saves, names).flatMap(({ s, found }) =>
			found.map((f) => ({ ...f, date: s.date, x: gameYear(s.date) }))
		)
	);
	// Each mod event takes over the earliest matching diffed milestone in its window, or stands alone.
	const taken = new Set<Milestone>();
	const logged = snaps
		.flatMap((s) => s.logEvents ?? [])
		.flatMap((e): Milestone[] => {
			const found = fromLog(e);
			if (!found) return [];
			const { kind, match, label } = found;
			const until = addGameDays(e.date, LOG_WINDOW_DAYS);
			const same = diffed
				.filter(
					(m) =>
						!taken.has(m) &&
						m.kind === kind &&
						m.date >= e.date &&
						m.date <= until &&
						match !== null &&
						m.label.includes(match)
				)
				.sort((p, q) => p.x - q.x)[0];
			if (same) taken.add(same);
			return [{ ...(same ?? { kind, label }), date: e.date, x: gameYear(e.date) }];
		});
	return [...diffed.filter((m) => !taken.has(m)), ...logged].sort((a, b) => a.x - b.x);
}
