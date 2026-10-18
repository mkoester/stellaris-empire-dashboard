import { error } from '@sveltejs/kit';
import {
	agendaRows,
	atLevel,
	edictRows,
	factionRows,
	facts,
	policyRows,
	possibleSeats,
	seatRows
} from '#lib/government.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { identity } from '#lib/server/empire.ts';
import { pick } from '#lib/server/explain.ts';

// The game's government screen: identity, council and agendas, policies, edicts, factions, read
// against the branch's latest save that has the government fields.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const s = snaps.findLast((x) => x.council !== null) ?? snaps.findLast((x) => x.kind === 'save');
	if (!s) error(404, 'no save yet');
	const f = facts(s);
	const policies = policyRows(data.policies, s.policies ?? {}, f);
	const agendas = agendaRows(data.agendas, s, f);
	const edicts = edictRows(data.edicts, s, f);
	const government = identity(snaps.findLast((x) => x.government !== null));
	const explanations = getExplanations();
	const seats = seatRows(
		s.council ?? [],
		s.ruler,
		s.government?.find((k) => k.startsWith('auth_')),
		data.councilPositions
	).map((r) => ({
		...r,
		// what the seat gives now: its per-level modifiers at the leader's level
		effects: atLevel(explanations[`seat:${r.key}`]?.modifiers ?? [], r.level)
	}));
	const possible = possibleSeats(
		data.councilPositions,
		seats.map((r) => r.key),
		f
	);
	return {
		...rest,
		seenAt: s.date,
		complete: s.council !== null, // read since the government tab exists
		government,
		seats,
		possibleSeats: possible,
		councilSlots: s.councilSlots,
		agenda: s.progress?.agenda ?? null,
		agendaDue: rest.upcoming.find((u) => u.kind === 'agenda') ?? null,
		agendas,
		policies,
		edicts,
		factions: factionRows(data.factionTypes, f),
		explain: pick(explanations, [
			...seats.map((r) => `seat:${r.key}`),
			...possible.map((p) => `seat:${p.key}`),
			...(government?.rows.flatMap((r) => r.items.map((i) => i.id)) ?? []),
			...agendas.map((a) => `agenda:${a.key}`),
			...policies.flatMap((p) => p.options.map((o) => `policy:${o.key}`)),
			...edicts.map((e) => `edict:${e.key}`)
		])
	};
}
