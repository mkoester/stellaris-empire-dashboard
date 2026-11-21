import { error } from '@sveltejs/kit';
import {
	allKinds,
	CATEGORIES,
	exhibitions,
	EXHIBITS_PER_CATEGORY,
	factsOf,
	factsOfOther,
	specimenGives,
	STORAGE_SLOTS,
	sumBonuses
} from '#lib/archive.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import type { ArchiveHolding } from '#lib/types.ts';

// The Grand Archive as the game's Collection view shows it: three exhibitions of 9 exhibits, the
// storage, and what the active exhibits give — each exhibition's bonuses × its multiplier (exact
// with companion mod 0.15.0, else ≈ 1). With the `archiveOthers` cheat, another empire's archive
// (`?empire=<id>`): one we do not talk to is "unknown empire" — its name never leaves the server.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const opts = display();
	const s = snaps.findLast((x) => x.kind === 'save' && x.archives !== null) ?? null;
	const all = s?.archives ?? [];
	const ours = all.find((a) => a.countryId === s?.countryId) ?? null;
	const talking = new Map(
		(s?.relations ?? []).filter((r) => r.communications).map((r) => [r.countryId, r.name])
	);
	const count = (a: ArchiveHolding) => a.exhibits.length + a.storage.length;
	const others = opts.archiveOthers
		? all
				.filter((a) => a.countryId !== s?.countryId && count(a) > 0)
				.map((a) => ({
					id: a.countryId,
					name: `${talking.get(a.countryId) ?? 'unknown empire'} (${count(a)} specimen${count(a) === 1 ? '' : 's'})`
				}))
				.sort((x, y) => x.name.localeCompare(y.name))
		: [];
	const wanted = Number(url.searchParams.get('empire'));
	const other = others.some((o) => o.id === wanted)
		? (all.find((a) => a.countryId === wanted) ?? null)
		: null;
	const shown = other ?? ours;
	const facts = other
		? factsOfOther(
				talking.has(other.countryId)
					? (s?.countries ?? []).find((c) => c.id === other.countryId)
					: undefined
			)
		: s
			? factsOf(s, data)
			: factsOfOther(undefined);
	const cats = exhibitions(shown, data, facts, shown?.mults ?? {});
	const name = (key: string) => data.specimens[key]?.name ?? key;
	return {
		...rest,
		seenAt: s?.date ?? null,
		noData: Object.keys(data.specimens).length === 0,
		bonusKinds: allKinds(data),
		others,
		shownId: other?.countryId ?? null,
		multExact: shown?.mults !== null && shown?.mults !== undefined,
		perCategory: EXHIBITS_PER_CATEGORY,
		storageSlots: STORAGE_SLOTS,
		categories: cats.map((c) => ({
			key: c.key,
			name: c.name,
			mult: c.mult,
			exhibits: c.exhibits.map((e) => ({
				id: e.id,
				name: e.spec?.name ?? name(e.specimen),
				rarity: e.spec?.rarity ?? null,
				unlocked: e.unlocked,
				active: e.active,
				added: e.added,
				bonuses: e.gives?.bonuses ?? [],
				produces: e.gives?.produces ?? {}
			})),
			bonuses: sumBonuses(c.bonuses),
			produces: c.produces
		})),
		total: sumBonuses(cats.flatMap((c) => c.bonuses)),
		totalProduces: cats.reduce<Record<string, number>>((sum, c) => {
			for (const [r, v] of Object.entries(c.produces)) sum[r] = (sum[r] ?? 0) + v;
			return sum;
		}, {}),
		// what each would give once exhibited and active, × its category's multiplier
		storage: (shown?.storage ?? []).map((e) => {
			const spec = data.specimens[e.specimen];
			const gives = spec
				? specimenGives(spec, facts, shown?.mults?.[spec.category] ?? 1)
				: { bonuses: [], produces: {} };
			return {
				id: e.id,
				name: name(e.specimen),
				rarity: spec?.rarity ?? null,
				category: CATEGORIES.find((c) => c.key === spec?.category)?.name ?? null,
				...gives
			};
		})
	};
}
