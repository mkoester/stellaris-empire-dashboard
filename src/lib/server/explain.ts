import { DatabaseSync } from 'node:sqlite';
import { pretty } from '#lib/format.ts';
import type { Explanation, Modifier } from '#lib/types.ts';

// Popup texts for traits, edicts, council agendas, policy options, techs, jobs and the empire's civics, origin,
// authority, ethics and government type, from the extraction's SQLite:
// descriptions, modifiers (labelled via modifier_label) and a few facts. Loaded once at start,
// keyed `<kind>:<key>` (e.g. `edict:fortify_the_border`).

export type Explanations = Record<string, Explanation>;

/** "costs 2 trait points" / "gives 1 trait point" (negative traits refund points). */
export const traitCost = (cost: number) =>
	`${cost > 0 ? 'costs' : 'gives'} ${Math.abs(cost)} trait point${Math.abs(cost) === 1 ? '' : 's'}`;

export function loadExplanations(file: string): Explanations {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
		const labels = new Map(
			rows<{ modifier_key: string; label: string; positive_is_good: number }>(
				'SELECT modifier_key, label, positive_is_good FROM modifier_label'
			).map((r) => [r.modifier_key, r])
		);
		const modifier = (key: string, value: number): Modifier => ({
			key,
			value,
			label: labels.get(key)?.label ?? null,
			positiveIsGood: (labels.get(key)?.positive_is_good ?? 1) === 1
		});
		const grouped = (sql: string) => {
			const out = new Map<string, Modifier[]>();
			for (const r of rows<{ owner: string; key: string; value: number }>(sql))
				out.set(r.owner, [...(out.get(r.owner) ?? []), modifier(r.key, r.value)]);
			return out;
		};
		const out: Explanations = {};

		const traitMods = grouped(
			'SELECT trait_key AS owner, modifier_key AS key, modifier_value AS value FROM trait_modifier ORDER BY sort_order'
		);
		for (const t of rows<{
			key: string;
			cost: number | null;
			description: string | null;
			effect: string | null;
		}>('SELECT key, cost, description, effect FROM trait'))
			out[`trait:${t.key}`] = {
				title: pretty(t.key.replace(/^trait_(pc_)?/, '')),
				description: t.description,
				modifiers: traitMods.get(t.key) ?? [],
				text: t.effect,
				facts: t.cost ? [traitCost(t.cost)] : []
			};

		// Edicts and agendas keep their modifiers in tradition_modifier (owner_key = key; an
		// agenda's finish modifier under `<key>#finish`).
		const ownedMods = grouped(
			'SELECT owner_key AS owner, modifier_key AS key, modifier_value AS value FROM tradition_modifier ORDER BY sort_order'
		);
		for (const e of rows<{
			key: string;
			name: string | null;
			description: string | null;
			tooltip: string | null;
			length: number | null;
		}>('SELECT key, name, description, tooltip, length FROM edict'))
			out[`edict:${e.key}`] = {
				title: e.name ?? pretty(e.key),
				description: e.description,
				modifiers: ownedMods.get(e.key) ?? [],
				text: e.tooltip,
				facts: [
					e.length === -1
						? 'perpetual, until cancelled'
						: `lasts ${Math.round((e.length ?? 0) / 360)} years`
				]
			};
		// Policy options keep theirs there too (owner_key = option key).
		for (const o of rows<{ key: string; name: string | null; description: string | null }>(
			'SELECT key, name, description FROM policy_option'
		))
			out[`policy:${o.key}`] = {
				title: o.name ?? pretty(o.key),
				description: o.description,
				modifiers: ownedMods.get(o.key) ?? [],
				text: null,
				facts: []
			};
		for (const a of rows<{
			key: string;
			name: string | null;
			description: string | null;
			effect_tooltip: string | null;
			cost: number | null;
			finish_days: number | null;
		}>('SELECT key, name, description, effect_tooltip, cost, finish_days FROM council_agenda')) {
			const finish = ownedMods.get(`${a.key}#finish`);
			out[`agenda:${a.key}`] = {
				title: a.name ?? pretty(a.key),
				description: a.description,
				modifiers: ownedMods.get(a.key) ?? [],
				text: a.effect_tooltip,
				after: finish
					? {
							label: `after launch, for ${Math.round((a.finish_days ?? 0) / 360)} years`,
							modifiers: finish
						}
					: undefined,
				facts: a.cost ? [`needs ${a.cost.toLocaleString('en')} agenda progress (base)`] : []
			};
		}

		// Static modifiers a save puts on the empire (events, agendas, …): `modifier:<key>`.
		const staticMods = grouped(
			'SELECT static_key AS owner, modifier_key AS key, modifier_value AS value FROM static_modifier_modifier ORDER BY sort_order'
		);
		for (const m of rows<{
			key: string;
			name: string | null;
			description: string | null;
			tooltip: string | null;
		}>('SELECT key, name, description, tooltip FROM static_modifier'))
			out[`modifier:${m.key}`] = {
				title: m.name ?? pretty(m.key),
				description: m.description,
				modifiers: staticMods.get(m.key) ?? [],
				text: m.tooltip,
				facts: []
			};

		// Deposits — planet features and blockers: `deposit:<key>`, with what they produce and what
		// clearing a blocker takes.
		const depositMods = grouped(
			'SELECT deposit_key AS owner, modifier_key AS key, modifier_value AS value FROM deposit_modifier'
		);
		const depositRes = new Map<string, { kind: string; resource: string; amount: number }[]>();
		for (const r of rows<{ owner: string; kind: string; resource: string; amount: number }>(
			'SELECT deposit_key AS owner, kind, resource, amount FROM deposit_resource'
		))
			depositRes.set(r.owner, [...(depositRes.get(r.owner) ?? []), r]);
		for (const d of rows<{
			key: string;
			name: string | null;
			is_blocker: number;
			clear_time: number | null;
		}>('SELECT key, name, is_blocker, clear_time FROM deposit')) {
			const res = depositRes.get(d.key) ?? [];
			const amounts = (kind: string) =>
				res
					.filter((r) => r.kind === kind)
					.map((r) => `${r.amount} ${pretty(r.resource)}`)
					.join(', ');
			out[`deposit:${d.key}`] = {
				title: (d.name ?? pretty(d.key)).replace(/^Blocker /, ''),
				description: null,
				modifiers: depositMods.get(d.key) ?? [],
				text: null,
				facts: [
					...(amounts('produces') ? [`produces ${amounts('produces')} per month`] : []),
					...(d.is_blocker
						? [`blocker: clearing takes ${d.clear_time ?? '?'} days and ${amounts('cost') || '?'}`]
						: [])
				]
			};
		}

		const techMods = grouped(
			'SELECT tech_key AS owner, modifier_key AS key, modifier_value AS value FROM technology_modifier ORDER BY sort_order'
		);
		for (const t of rows<{
			key: string;
			label: string | null;
			description: string | null;
			area: string;
			tier: number | null;
			cost: number | null;
		}>('SELECT key, label, description, area, tier, cost FROM technology'))
			out[`tech:${t.key}`] = {
				title: t.label ?? pretty(t.key),
				description: t.description,
				modifiers: techMods.get(t.key) ?? [],
				text: null,
				facts: [
					`${t.area}, tier ${t.tier ?? '?'}`,
					...(t.cost ? [`base cost ${t.cost.toLocaleString('en')}`] : [])
				]
			};

		// Traditions and ascension perks: modifiers in tradition_modifier (owner_key = key).
		for (const t of rows<{
			key: string;
			name: string | null;
			description: string | null;
			tooltip: string | null;
		}>('SELECT key, name, description, tooltip FROM tradition'))
			out[`tradition:${t.key}`] = {
				title: t.name ?? pretty(t.key),
				description: t.description,
				modifiers: ownedMods.get(t.key) ?? [],
				text: t.tooltip,
				facts: []
			};
		for (const p of rows<{
			key: string;
			name: string | null;
			description: string | null;
			tooltip: string | null;
		}>('SELECT key, name, description, tooltip FROM ascension_perk'))
			out[`perk:${p.key}`] = {
				title: p.name ?? pretty(p.key),
				description: p.description,
				modifiers: ownedMods.get(p.key) ?? [],
				text: p.tooltip,
				facts: []
			};

		const jobMods = grouped(
			'SELECT job_key AS owner, modifier AS key, value FROM job_modifier ORDER BY sort_order'
		);
		for (const j of rows<{
			key: string;
			name: string | null;
			category: string | null;
			description: string | null;
		}>('SELECT key, name, category, description FROM job'))
			out[`job:${j.key}`] = {
				title: j.name ?? pretty(j.key),
				description: j.description,
				modifiers: jobMods.get(j.key) ?? [],
				text: null,
				facts: j.category ? [j.category] : []
			};

		// The empire's identity — civics, origin, authority, ethics, government type — after the
		// planner's civics/origins/government/ethics pages (same tables). A civic's or origin's
		// `description` is the game's effects tooltip, so it goes to `text`.
		const listed = (sql: string) => {
			const out = new Map<string, string[]>();
			for (const r of rows<{ owner: string; item: string }>(sql))
				out.set(r.owner, [...(out.get(r.owner) ?? []), r.item]);
			return out;
		};
		// one line per replaced job; variants for other empire types in brackets
		const swaps = new Map<string, string[]>();
		for (const [owner, pairs] of listed(
			`SELECT source_key AS owner, coalesce(base_name, base_job) || '|' || coalesce(swapped_name, swapped_job) AS item
			 FROM job_swap ORDER BY sort_order`
		)) {
			const byBase = new Map<string, string[]>();
			for (const [base, to] of pairs.map((p) => p.split('|')))
				byBase.set(base, [...(byBase.get(base) ?? []), to]);
			swaps.set(
				owner,
				[...byBase].map(
					([base, [to, ...or]]) => `${base} → ${to}${or.length ? ` (or ${or.join(', ')})` : ''}`
				)
			);
		}
		const unlocks = listed(
			`SELECT DISTINCT u.owner_key AS owner, coalesce(b.name, u.building_key) AS item
			 FROM building_unlock u LEFT JOIN building b ON b.key = u.building_key ORDER BY item`
		);
		const traits = listed('SELECT owner_key AS owner, trait_key AS item FROM granted_trait');
		const choiceFacts = (key: string) => [
			...(swaps.get(key) ?? []).map((s) => `job: ${s}`),
			...(unlocks.get(key) ?? []).map((b) => `unlocks ${b}`),
			...(traits.get(key) ?? []).map(
				(t) => `grants trait ${pretty(t.replace(/^trait_(pc_)?/, ''))}`
			)
		];
		// the Shroud's "Add Attunement" (on every civic) after the real effects
		const attunementLast = (mods: Modifier[]) => [
			...mods.filter((m) => !m.key.includes('attunement')),
			...mods.filter((m) => m.key.includes('attunement'))
		];

		const civicMods = grouped(
			'SELECT civic_key AS owner, modifier_key AS key, modifier_value AS value FROM civic_modifier ORDER BY sort_order'
		);
		const seatMods = grouped(
			'SELECT position_key AS owner, modifier_key AS key, modifier_value AS value FROM council_position_modifier ORDER BY sort_order'
		);
		const seats = new Map(
			rows<{
				key: string;
				civic_key: string;
				name: string | null;
				leader_classes: string | null;
				effect: string | null;
			}>(
				'SELECT key, civic_key, name, leader_classes, effect FROM council_position WHERE civic_key IS NOT NULL'
			).map((s) => [s.civic_key, s])
		);
		// Leader traits: `ltrait:<key>`, each modifier labelled with where it applies.
		const ltraitMods = new Map<string, Modifier[]>();
		for (const r of rows<{ owner: string; scope: string; key: string; value: number }>(
			'SELECT trait_key AS owner, scope, modifier_key AS key, modifier_value AS value FROM leader_trait_modifier ORDER BY sort_order'
		)) {
			const m = modifier(r.key, r.value);
			const where = r.scope === 'country' ? '' : ` (${r.scope})`;
			ltraitMods.set(r.owner, [
				...(ltraitMods.get(r.owner) ?? []),
				{ ...m, label: m.label ? `${m.label}${where}` : `${pretty(r.key)}${where}` }
			]);
		}
		// and what each gives while its leader sits on the council (`councilor_modifier`: "applied to
		// country if leader is on the Council", flat, not per level): `ltraitcouncil:<key>`
		const councilMods = new Map<string, Modifier[]>();
		for (const r of rows<{ owner: string; key: string; value: number }>(
			"SELECT trait_key AS owner, modifier_key AS key, modifier_value AS value FROM leader_trait_modifier WHERE scope = 'councilor' ORDER BY sort_order"
		))
			councilMods.set(r.owner, [...(councilMods.get(r.owner) ?? []), modifier(r.key, r.value)]);
		for (const [key, mods] of councilMods)
			out[`ltraitcouncil:${key}`] = {
				title: key,
				description: null,
				modifiers: mods,
				text: null,
				facts: []
			};
		for (const t of rows<{
			key: string;
			name: string | null;
			description: string | null;
			leader_classes: string | null;
		}>('SELECT key, name, description, leader_classes FROM leader_trait'))
			out[`ltrait:${t.key}`] = {
				title: t.name ?? pretty(t.key),
				description: t.description,
				modifiers: ltraitMods.get(t.key) ?? [],
				text: null,
				facts: t.leader_classes ? [`for: ${t.leader_classes.replaceAll(',', ', ')}`] : []
			};
		// Every council seat: `seat:<key>`, modifiers per leader level (the government tab scales them).
		for (const p of rows<{
			key: string;
			name: string | null;
			description: string | null;
			leader_classes: string | null;
			effect: string | null;
		}>('SELECT key, name, description, leader_classes, effect FROM council_position'))
			out[`seat:${p.key}`] = {
				title: p.name ?? pretty(p.key),
				description: p.description,
				modifiers: seatMods.get(p.key) ?? [],
				text: p.effect,
				facts: [
					'modifiers per leader level',
					...(p.leader_classes ? [`for: ${p.leader_classes.replaceAll(',', ', ')}`] : [])
				]
			};
		for (const c of rows<{
			key: string;
			name: string | null;
			description: string | null;
			locked: number;
		}>('SELECT key, name, description, locked FROM civic')) {
			const seat = seats.get(c.key);
			const seatName = seat
				? `${seat.name ?? pretty(seat.key)}${seat.leader_classes ? ` (${seat.leader_classes.replaceAll(',', ', ')})` : ''}`
				: '';
			out[`civic:${c.key}`] = {
				title: c.name ?? pretty(c.key),
				description: null,
				modifiers: attunementLast(civicMods.get(c.key) ?? []),
				text:
					[c.description, seat?.effect && `Council seat ${seatName}: ${seat.effect}`]
						.filter(Boolean)
						.join('\n') || null,
				after:
					seat && seatMods.get(seat.key)
						? {
								label: `council seat ${seatName}, per leader level`,
								modifiers: seatMods.get(seat.key)!
							}
						: undefined,
				facts: [
					...(seat && !seatMods.get(seat.key) && !seat.effect ? [`council seat ${seatName}`] : []),
					...choiceFacts(c.key),
					...(c.locked ? ['cannot be changed after game start'] : [])
				]
			};
		}

		const planetNames = new Map(
			rows<{ key: string; name: string | null }>('SELECT key, name FROM planet_class').map((p) => [
				p.key,
				p.name
			])
		);
		const originMods = grouped(
			'SELECT origin_key AS owner, modifier_key AS key, modifier_value AS value FROM origin_modifier ORDER BY sort_order'
		);
		for (const o of rows<{
			key: string;
			name: string | null;
			description: string | null;
			starting_colony: string | null;
		}>('SELECT key, name, description, starting_colony FROM origin'))
			out[`origin:${o.key}`] = {
				title: o.name ?? pretty(o.key),
				description: null,
				modifiers: attunementLast(originMods.get(o.key) ?? []),
				text: o.description,
				facts: [
					...(o.starting_colony
						? [`starts on ${planetNames.get(o.starting_colony) ?? pretty(o.starting_colony)}`]
						: []),
					...choiceFacts(o.key)
				]
			};

		const authorityMods = grouped(
			'SELECT authority_key AS owner, modifier_key AS key, modifier_value AS value FROM authority_modifier ORDER BY sort_order'
		);
		for (const a of rows<{ key: string; name: string | null; description: string | null }>(
			'SELECT key, name, description FROM authority'
		))
			out[`authority:${a.key}`] = {
				title: a.name ?? pretty(a.key),
				description: a.description,
				modifiers: authorityMods.get(a.key) ?? [],
				text: null,
				facts: []
			};

		const ethicMods = grouped(
			'SELECT ethic_key AS owner, modifier_key AS key, modifier_value AS value FROM ethic_modifier ORDER BY sort_order'
		);
		const implications = listed(
			`SELECT t.ethic_key AS owner, coalesce(l.label, t.tag) AS item
			 FROM ethic_tag t LEFT JOIN ethic_tag_label l ON l.tag = t.tag ORDER BY t.sort_order`
		);
		const forbids = listed(
			`SELECT ethic_key AS owner, coalesce(option_label, option_key) AS item
			 FROM ethic_policy_restriction ORDER BY policy_key, option_key`
		);
		for (const e of rows<{ key: string; label: string | null }>('SELECT key, label FROM ethic'))
			out[`ethic:${e.key}`] = {
				title: e.label ?? pretty(e.key.replace(/^ethic_/, '')),
				description: null,
				modifiers: ethicMods.get(e.key) ?? [],
				text: (implications.get(e.key) ?? []).join('\n') || null,
				facts: forbids.get(e.key) ? [`forbids policies: ${forbids.get(e.key)!.join(', ')}`] : []
			};

		for (const g of rows<{ key: string; name: string | null }>(
			'SELECT key, name FROM government_type'
		))
			out[`gov:${g.key}`] = {
				title: g.name ?? pretty(g.key.replace(/^gov_/, '')),
				description: null,
				modifiers: [],
				text: 'The game names the government after its authority, ethics and civics.',
				facts: []
			};
		return out;
	} finally {
		db.close();
	}
}

/** The explanations a page needs, for the `<kind>:<key>` ids it shows. */
export const pick = <T>(all: Record<string, T>, ids: string[]): Record<string, T> =>
	Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]));
