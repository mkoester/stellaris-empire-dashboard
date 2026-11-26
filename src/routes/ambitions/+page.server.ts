import { error } from '@sveltejs/kit';
import { ambitionsWhy, isRevealed, levelOf, PERKS_BEFORE } from '#lib/ambitions.ts';
import { facts } from '#lib/government.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import { evaluate } from '#lib/triggers.ts';

// The ambitions tab (4.6): our ambition as the Situation Log shows it (its level of five, the
// currency, each level's requirements and perks, the objectives that earn the currency), or the
// ambitions this empire could take. Others' (docs/save-format.md, "Ambitions"): the
// `ambitionsRevealed` spoiler shows those the game gave away by an AI personality on the
// diplomacy screen, the `ambitionsAll` cheat every one with its level.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const opts = display();
	const s = snaps.findLast((x) => x.kind === 'save' && x.ambitions) ?? null;
	const rows = s?.ambitions ?? [];
	const us = s?.countryId ?? null;
	const talking = new Map(
		(s?.relations ?? []).filter((x) => x.communications).map((x) => [x.countryId, x.name])
	);
	const mine = rows.find((a) => a.countryId === us) ?? null;
	const path = mine ? data.ambitionPaths[mine.path] : undefined;
	const level = mine ? levelOf(mine, path) : 0;
	const amount = path?.currency ? (s?.stockpile[path.currency] ?? 0) : null;

	// none yet: the ambitions this empire may take (their perk's `potential`), greyed until allowed
	const f = s && !mine ? facts(s, data.scriptedTriggers) : null;
	const perksHeld = (s?.ascensionPerks ?? []).length;
	const choices = f
		? Object.values(data.ambitionPaths)
				.filter((p) => p.perk && evaluate(data.perkRules[p.perk]?.potential ?? null, f) !== false)
				.map((p) => ({
					key: p.key,
					name: p.name,
					perk: data.perks[p.perk!] ?? p.perk!,
					currency: p.currency,
					description: p.description,
					why:
						perksHeld < PERKS_BEFORE
							? `needs ${PERKS_BEFORE} ascension perks first (${perksHeld} taken)`
							: null
				}))
		: [];

	const tellAll = opts.ambitionsAll;
	const others = rows
		.filter((a) => a.countryId !== us)
		.filter((a) => tellAll || (opts.ambitionsRevealed && isRevealed(a, new Set(talking.keys()))))
		.map((a) => ({
			id: a.countryId,
			name: talking.get(a.countryId) ?? 'unknown empire',
			path: data.ambitionPaths[a.path]?.name ?? a.path,
			// the level only with the cheat: the game shows none
			level: tellAll ? levelOf(a, data.ambitionPaths[a.path]) : null,
			shownAs:
				a.personality && isRevealed(a, new Set(talking.keys()))
					? (data.personalities[a.personality]?.name ?? a.personality)
					: null
		}))
		.sort((x, y) => x.name.localeCompare(y.name));

	return {
		...rest,
		seenAt: s?.date ?? null,
		why: s ? ambitionsWhy(s.ambitions, us) : null,
		noData: Object.keys(data.ambitionPaths).length === 0,
		mine: path
			? {
					name: path.name,
					description: path.description,
					currency: path.currency,
					amount,
					level,
					levels: path.levels.map((l) => ({
						...l,
						reached: l.level <= level,
						next: l.level === level + 1
					})),
					objectives: path.objectives
				}
			: mine
				? { unknownPath: mine.path }
				: null,
		choices,
		others,
		othersShown: opts.ambitionsAll || opts.ambitionsRevealed,
		tellAll
	};
}
