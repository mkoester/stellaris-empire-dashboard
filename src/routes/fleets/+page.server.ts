import { error } from '@sveltejs/kit';
import { configurable, designComponents, type ShipParts } from '#lib/designStats.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Our military fleets and ship designs at the branch's latest save that has them (READER 53),
// with the data DB's parts of the designs shown — their stats are added up in the page.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.designs !== null) ?? null;
	const { shipParts } = getGameData();
	// only what the player configures in the ship designer (#lib/designStats.ts `configurable`)
	const designs = (latest?.designs ?? []).filter((d) => configurable(d.size, shipParts));
	const parts: ShipParts = {
		sizes: pick(
			shipParts.sizes,
			designs.map((d) => d.size)
		),
		sections: pick(
			shipParts.sections,
			designs.flatMap((d) => d.sections.map((s) => s.template))
		),
		components: pick(shipParts.components, designs.flatMap(designComponents))
	};
	return {
		...rest,
		date: latest?.date ?? null,
		designs,
		fleets: latest?.fleets ?? [],
		parts,
		// a data DB from before 2026-11-09 has no ship parts: names and keys only
		hasParts: Object.keys(shipParts.components).length > 0,
		selected: Number(url.searchParams.get('design')) || null
	};
}
