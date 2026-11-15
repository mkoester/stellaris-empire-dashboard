import type { EmpireSpecies, SlaveOffer, SpeciesInfo } from '#lib/types.ts';
import type { RawSave } from '../save.ts';
import { migrationPartners } from './colonies.ts';
import { displayName, isPrescripted, isYes, items, list, num, type Raw } from './values.ts';

// Save → Snapshot: species, their rights and the slave market (../save.ts; paths in
// docs/save-format.md).

const RIGHT_KINDS = [
	'citizenship',
	'subspecies_integration',
	'living_standard',
	'military_service',
	'colonization_control',
	'population_control',
	'migration_control',
	'slavery',
	'purge'
];

/**
 * Each species' rights: `country.modules.standard_species_rights_module` holds the founder's in
 * `primary = { species_index citizenship living_standard … }` and every other species' in
 * `species_rights = { { species_index … } … }` (Fangnaur 2200.08, 4.5.3: the enslaved Quenti only
 * there — read before READER 51 from `primary` alone); `default` is for new species,
 * `built_species` for robots.
 */
export function speciesRights(country: Raw): Record<string, Record<string, string>> {
	const m = country?.modules?.standard_species_rights_module;
	return Object.fromEntries(
		[...items(m?.primary), ...items(m?.species_rights)]
			.filter((p) => typeof p?.species_index === 'number')
			.map((p) => [
				String(p.species_index),
				Object.fromEntries(
					RIGHT_KINDS.filter((k) => typeof p[k] === 'string').map((k) => [k, p[k]])
				)
			])
	);
}

/**
 * Species with pops on the empire's colonies (`pop_groups.key.species` → `species_db`), with
 * their traits. Names are localisation keys the save does not resolve.
 */
export function speciesInfo(
	raw: Pick<RawSave, 'country' | 'colonies' | 'popGroups' | 'speciesDb'>
): SpeciesInfo[] {
	return [...speciesPops(raw, raw.country)].map(([id, n]) => {
		const s = raw.speciesDb[id] ?? {};
		return {
			id,
			name: speciesName(s.name),
			cls: String(s.class ?? ''),
			traits: items(s.traits?.trait).map(String),
			pops: n
		};
	});
}

/** Pops per species id on a country's colonies (`pop_groups.key.species`, summed `size`). */
function speciesPops(raw: Pick<RawSave, 'colonies' | 'popGroups'>, country: Raw) {
	const pops = new Map<string, number>();
	for (const colonyId of list(country?.controlled_colonies))
		for (const g of list(raw.colonies[String(colonyId)]?.pop_groups)) {
			const group = raw.popGroups[String(g)];
			const sp = group?.key?.species;
			if (sp !== undefined) pops.set(String(sp), (pops.get(String(sp)) ?? 0) + num(group.size));
		}
	return pops;
}

/**
 * Pops by species of our empire and of each empire we have a migration treaty with (READER 45):
 * whose pops went where, read as the change between saves — the save books migration per colony,
 * and per species only as net growth (`last_month_growth_data.species`). Each empire's founder
 * species (`founder_species_ref`) is its main one; species under 1 % of an empire are left out.
 * Every other empire we have communications with lists only our species there (`onlyOurs`, READER
 * 47): treaties end, emigrants stay (throwaway Theian Preservers 2214.01: 338 Theians in three
 * colonies of the Baanthurian Council after its treaty had ended).
 */
export function speciesByEmpire(
	raw: Pick<
		RawSave,
		'country' | 'countryId' | 'countryBlocks' | 'colonies' | 'popGroups' | 'speciesDb'
	>
): EmpireSpecies[] {
	const byName = (c: Raw) => {
		// by name: a modified species keeps its parent's name (Oklarr 2214.02: two "Pyrragthul")
		const out = new Map<string, number>();
		for (const [sp, n] of speciesPops(raw, c)) {
			const name = speciesName(raw.speciesDb[sp]?.name);
			out.set(name, (out.get(name) ?? 0) + n);
		}
		return out;
	};
	const entry = (id: number, c: Raw, species: [string, number][]) => {
		const founder = c.founder_species_ref;
		return {
			countryId: id,
			founder: founder === undefined ? null : speciesName(raw.speciesDb[String(founder)]?.name),
			species: species.map(([name, n]) => ({ name, pops: n })).sort((a, b) => b.pops - a.pops)
		};
	};
	const full = (id: number, c: Raw) => {
		const pops = [...byName(c)];
		const total = pops.reduce((t, [, n]) => t + n, 0);
		return entry(
			id,
			c,
			pops.filter(([, n]) => n > 0 && n >= total / 100)
		);
	};
	const us = full(raw.countryId, raw.country);
	const ours = new Set(us.species.map((s) => s.name));
	const partners = migrationPartners(raw.country);
	const contacts = items(raw.country?.relations_manager?.relation)
		.filter((r) => isYes(r?.communications))
		.map((r) => Number(r.country))
		.filter((id) => !partners.has(id) && id !== raw.countryId);
	return [
		us,
		...[...partners].flatMap((id) => {
			const c = raw.countryBlocks[String(id)];
			return c && typeof c === 'object' ? [full(id, c)] : [];
		}),
		...contacts.flatMap((id) => {
			const c = raw.countryBlocks[String(id)];
			if (!c || typeof c !== 'object') return [];
			const there = [...byName(c)].filter(([name, n]) => ours.has(name) && n > 0);
			return there.length ? [{ ...entry(id, c, there), onlyOurs: true as const }] : [];
		})
	];
}

/**
 * The Slave Market's offers (`slave_market_manager.slaves_on_market = { { key=<pop group>
 * value=<pops> } }`, 4.5.3 Fangnaur 2200.02.09): the pop group gives species and colony
 * (`planet` is a colony id), the country controlling that colony the seller.
 */
export function slaveMarket(
	raw: Pick<
		RawSave,
		'slaveMarket' | 'popGroups' | 'speciesDb' | 'countryId' | 'countryBlocks' | 'empireName'
	>
): SlaveOffer[] {
	const offers = items(raw.slaveMarket);
	if (!offers.length) return [];
	const owner = new Map<string, number>();
	for (const [id, c] of Object.entries(raw.countryBlocks))
		if (c && typeof c === 'object')
			for (const colony of list(c.controlled_colonies)) owner.set(String(colony), Number(id));
	return offers.flatMap((e) => {
		const id = Number(e?.key);
		if (!Number.isFinite(id)) return [];
		const group = raw.popGroups[String(id)] ?? {};
		const seller = owner.get(String(group.planet)) ?? null;
		const c = seller === null ? null : raw.countryBlocks[String(seller)];
		return [
			{
				popGroup: id,
				species: speciesName(raw.speciesDb[String(group.key?.species)]?.name),
				pops: num(e.value),
				groupSize: num(group.size),
				seller,
				sellerName:
					seller === null
						? '?'
						: seller === raw.countryId
							? raw.empireName
							: displayName(c?.name) || `empire ${seller}`
			}
		];
	});
}

/**
 * A species' name as displayName reads it — the data DB's prescripted names first
 * (`PRESCRIPTED_species_name_zrobots` → "Yorphid") —, else a prescripted key's suffix
 * (`PRESCRIPTED_species_name_humans1` → `Humans`).
 */
export function speciesName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	const m = /^PRESCRIPTED_species_name_([a-z_]+?)\d*$/i.exec(key);
	return m && !isPrescripted(key)
		? m[1].charAt(0).toUpperCase() + m[1].slice(1)
		: displayName(name);
}
