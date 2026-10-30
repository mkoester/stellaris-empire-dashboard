import { error } from '@sveltejs/kit';
import {
	agendaRows,
	atLevel,
	councilorBonus,
	edictRows,
	facts,
	policyRows,
	possibleSeats,
	seatRows
} from '#lib/government.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { identity } from '#lib/server/empire.ts';
import { pick } from '#lib/server/explain.ts';
import { display } from '#lib/server/settings.ts';

// The game's government screen: identity, council and agendas, policies, edicts (factions: the
// ethics tab), read against the branch's latest save that has the government fields.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const s = snaps.findLast((x) => x.council !== null) ?? snaps.findLast((x) => x.kind === 'save');
	if (!s) error(404, 'no save yet');
	const f = facts(s, data.scriptedTriggers, {
		electionTypes: data.electionTypes,
		slavery: data.speciesRights.flatMap((k) =>
			k.options.filter((o) => o.isSlavery).map((o) => o.key)
		)
	});
	const { showLocked } = display();
	const policies = policyRows(data.policies, s.policies ?? {}, f, showLocked);
	// the measured agenda rate (progress/month) and the empire-size factor on costs, from the
	// agenda being prepared: an estimate for every other one, if picked next and started from 0
	const due = rest.upcoming.find((u) => u.kind === 'agenda' && u.total !== undefined);
	const current = s.progress?.agenda;
	const base = current ? data.agendas[current.key]?.cost : null;
	const rate =
		due && current && due.months > 0 ? (due.total! - current.progress) / due.months : null;
	const factor = due && base ? due.total! / base : 1;
	const agendas = agendaRows(data.agendas, s, f).map((a) => ({
		...a,
		months: rate && a.cost ? Math.ceil((a.cost * factor) / rate) : null
	}));
	const edicts = edictRows(data.edicts, s, f);
	const government = identity(snaps.findLast((x) => x.government !== null));
	const explanations = getExplanations();
	const bonus = councilorBonus(s, data.councilorSkill);
	const bonusTotal = bonus.reduce((a, b) => a + b.value, 0);
	const seats = seatRows(
		s.council ?? [],
		s.ruler,
		s.government?.find((k) => k.startsWith('auth_')),
		data.councilPositions
	).map((r) => {
		// the councilor level: the leader's level, its own extra levels, the country's bonus
		const council = r.level === null ? null : r.level + r.bonus + bonusTotal;
		const perLevel = explanations[`seat:${r.key}`]?.modifiers ?? [];
		return {
			...r,
			council,
			classes: data.councilPositions[r.key]?.classes ?? [],
			// per level, and what that gives at the councilor level
			effects: perLevel.map((m, i) => ({ perLevel: m, now: atLevel(perLevel, council)[i] })),
			// the leader's traits while on the council (flat, not per level)
			traitEffects: r.traits.flatMap((t) =>
				explanations[`ltraitcouncil:${t}`]
					? [
							{
								trait: t,
								name: explanations[`ltrait:${t}`]?.title ?? t,
								modifiers: explanations[`ltraitcouncil:${t}`].modifiers
							}
						]
					: []
			)
		};
	});
	const possible = possibleSeats(
		data.councilPositions,
		seats.map((r) => r.key),
		f
	).map((p) => ({ ...p, classes: data.councilPositions[p.key]?.classes ?? [] }));
	return {
		...rest,
		seenAt: s.date,
		showLocked,
		complete: s.council !== null, // read since the government tab exists
		government,
		seats,
		councilBonus: bonus.map((b) => ({
			...b,
			name:
				explanations[`tradition:${b.source}`]?.title ??
				explanations[`civic:${b.source}`]?.title ??
				explanations[`edict:${b.source}`]?.title ??
				explanations[`modifier:${b.source}`]?.title ??
				b.source
		})),
		possibleSeats: possible,
		councilSlots: s.councilSlots,
		agenda: s.progress?.agenda ?? null,
		agendaDue: rest.upcoming.find((u) => u.kind === 'agenda') ?? null,
		agendas,
		policies,
		edicts,
		techNames: Object.fromEntries(
			edicts.flatMap((e) => e.needs).map((t) => [t, data.techs[t]?.name ?? t])
		),
		explain: pick(explanations, [
			...seats.map((r) => `seat:${r.key}`),
			...seats.flatMap((r) => r.traits.map((t) => `ltrait:${t}`)),
			...possible.map((p) => `seat:${p.key}`),
			...(government?.rows.flatMap((r) => r.items.map((i) => i.id)) ?? []),
			...agendas.map((a) => `agenda:${a.key}`),
			...policies.flatMap((p) => p.options.map((o) => `policy:${o.key}`)),
			...edicts.map((e) => `edict:${e.key}`)
		])
	};
}
