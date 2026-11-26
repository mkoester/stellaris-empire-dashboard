import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import { ideologiesWhy, knownIds, levelProgress, offeredTier, ownStand } from '#lib/ideologies.ts';
import type { GameData, Ideology, IdeologyStand } from '#lib/types.ts';

// The ideologies tab (4.6), as the game's Ideologies view shows it: our ideology (strength, level,
// momentum, tenets and what each gives, the choice on offer) and the ideologies we know — the keys
// of our module's `intel` (docs/save-format.md, "Ideologies"). With the `ideologiesAll` cheat
// every ideology, its adopters and their strength; an empire we do not talk to is "unknown empire".
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const all = display().ideologiesAll;
	const s = snaps.findLast((x) => x.kind === 'save' && x.ideologies) ?? null;
	const r = s?.ideologies ?? null;
	const us = s?.countryId ?? null;
	const talking = new Map(
		(s?.relations ?? []).filter((x) => x.communications).map((x) => [x.countryId, x.name])
	);
	const nameOf = (id: number | null) =>
		id === null ? null : id === us ? 'us' : (talking.get(id) ?? 'unknown empire');
	const own = r ? ownStand(r, us) : null;
	const known = r ? knownIds(r, us) : new Set<number>();
	const shown = (r?.ideologies ?? []).filter((i) => all || known.has(i.id));
	const stands = new Map((r?.stands ?? []).map((x) => [x.countryId, x]));
	const view = (i: Ideology) => ({
		id: i.id,
		name: i.name,
		type: typeLabel(i.type, data),
		ours: i.id === own?.adopted,
		known: known.has(i.id),
		custodian: nameOf(i.custodian),
		founder: all ? nameOf(i.founder) : null,
		tenets: i.tenets.map((t) => tenetView(t.key, t.tier, data)),
		// cheat: who adopted it and how strong it is with each
		adopters: all ? i.adopters.map((id) => adopterView(id, nameOf(id), stands.get(id))) : [],
		systems: all ? i.systems : null
	});
	const ours = shown.find((i) => i.id === own?.adopted) ?? null;
	return {
		...rest,
		seenAt: s?.date ?? null,
		why: s ? ideologiesWhy(r, us) : null,
		noData: Object.keys(data.tenets).length === 0,
		all,
		ours: ours
			? {
					...view(ours),
					strength: own?.strength ?? 0,
					progress: levelProgress(own?.strength ?? 0),
					momentum: own?.momentum ?? null,
					pendingLevels: own?.pendingLevels ?? 0,
					// the choice on offer for each open slot, with what each tenet gives at that slot
					offered: ours.offered.map((keys, n) => {
						const tier = offeredTier(ours, n);
						return { tier, tenets: keys.map((k) => tenetView(k, tier, data)) };
					})
				}
			: null,
		others: shown.filter((i) => i !== ours).map(view)
	};
}

function typeLabel(type: string, data: GameData): string {
	const t = data.ideologyTypes[type];
	const ethic = t?.ethic ? (data.identityNames[t.ethic] ?? t.ethic) : type;
	return `${ethic.replace(/^Fanatic /, '')} ${t?.typeName ?? 'Ideology'}`;
}

function tenetView(key: string, tier: number, data: GameData) {
	const t = data.tenets[key];
	return {
		key,
		tier,
		name: t?.name ?? key,
		description: t?.description ?? null,
		modifiers: t?.tiers[tier]?.modifiers ?? [],
		text: t?.tiers[tier]?.text ?? null
	};
}

function adopterView(id: number, name: string | null, stand: IdeologyStand | undefined) {
	return {
		id,
		name: name ?? 'unknown empire',
		strength: stand?.strength ?? null,
		level: stand?.level ?? null, // 0–3: the tenet slots its strength has opened
		momentum: stand?.momentum ?? null
	};
}
