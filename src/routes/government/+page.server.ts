import { error } from '@sveltejs/kit';
import {
	agendaRows,
	councilorBonus,
	councilSeats,
	edictRows,
	facts,
	policyRows,
	possibleSeats
} from '#lib/government.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { identity } from '#lib/server/empire.ts';
import { pick } from '#lib/server/explain.ts';
import { display } from '#lib/server/settings.ts';
import { whatIfInputs, whatIfOf } from '#lib/server/whatIfs.ts';
import { swapModifiers, type WhatIf } from '#lib/whatIf.ts';

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
		shipKinds: data.shipKinds,
		electionTypes: data.electionTypes,
		archetypes: data.speciesArchetypes,
		slavery: data.speciesRights.flatMap((k) =>
			k.options.filter((o) => o.isSlavery).map((o) => o.key)
		)
	});
	const { showLocked, whatIfs: showWhatIfs } = display();
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
	const seats = councilSeats(s, data, explanations);
	const possible = possibleSeats(
		data.councilPositions,
		seats.map((r) => r.key),
		f
	).map((p) => ({ ...p, classes: data.councilPositions[p.key]?.classes ?? [] }));
	// ≈ what enacting an edict (cancelling an active one) or switching a policy would do now
	const whatIfs: Record<string, WhatIf> = {};
	const inputs = showWhatIfs ? whatIfInputs(b) : null;
	if (inputs) {
		for (const e of edicts) {
			const mods = data.edictModifiers[e.key];
			const w = whatIfOf(
				e.active ? Object.fromEntries(Object.entries(mods ?? {}).map(([k, v]) => [k, -v])) : mods,
				inputs
			);
			if (w) whatIfs[`edict:${e.key}`] = w;
		}
		for (const p of policies)
			for (const o of p.options.filter((o) => !o.selected)) {
				const w = whatIfOf(
					swapModifiers(
						p.selected ? data.policyModifiers[p.selected] : undefined,
						data.policyModifiers[o.key]
					),
					inputs
				);
				if (w) whatIfs[`policy:${o.key}`] = w;
			}
	}
	return {
		...rest,
		whatIfs: inputs ? whatIfs : null,
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
