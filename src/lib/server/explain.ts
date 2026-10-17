import { DatabaseSync } from 'node:sqlite';
import { pretty } from '#lib/format.ts';
import type { Explanation, Modifier } from '#lib/types.ts';

// Popup texts for traits, edicts, council agendas, techs and jobs, from the extraction's SQLite:
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
		return out;
	} finally {
		db.close();
	}
}

/** The explanations a page needs, for the `<kind>:<key>` ids it shows. */
export const pick = (all: Explanations, ids: string[]): Explanations =>
	Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]));
