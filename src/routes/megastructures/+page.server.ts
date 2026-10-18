import { error } from '@sveltejs/kit';
import { candidates, KINDS, MEGA_RULES } from '#lib/megastructures.ts';
import { discovered, jumpsFromBorder, mapView } from '#lib/situations.ts';
import { display } from '#lib/server/settings.ts';
import { getDb, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { galaxyOf } from '#lib/server/db.ts';

// Where to build each kilo- and megastructure, over the campaign's latest galaxy reading.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.firstContacts !== null);
	const g = s ? galaxyOf(getDb(), s.campaign) : null;
	const { wholeGalaxy: whole, unknownStars: stars } = display();
	// what is not discovered is neither a candidate nor counted (the catapult's farthest system);
	// with the unknown stars shown, their stars count (the game shows a star's class), not bodies
	const galaxy = discovered(g?.systems ?? [], { whole, stars });
	const beyond = jumpsFromBorder(galaxy);
	const data = getGameData();
	// who owns what we know of: ourselves, or an empire by the name we know it under
	const owners = Object.fromEntries([
		...(s?.countries ?? []).map((c) => [c.id, c.name]),
		...(s?.relations ?? []).map((r) => [r.countryId, r.name]),
		...(s?.countryId !== null && s?.countryId !== undefined ? [[s.countryId, 'us']] : [])
	]);
	const machineAge = s?.dlcs?.includes('The Machine Age') ?? null;
	return {
		...rest,
		seenAt: g?.date ?? null,
		wholeGalaxy: whole,
		machineAge,
		owners,
		systems: mapView(g?.systems ?? [], { whole, stars }),
		kinds: KINDS.map((kind) => ({
			kind,
			...MEGA_RULES[kind],
			// needs (or excludes) The Machine Age: shown, but marked, when the save says otherwise
			available:
				MEGA_RULES[kind].machineAge === undefined || machineAge === null
					? true
					: MEGA_RULES[kind].machineAge === machineAge,
			rows: candidates(kind, galaxy, beyond, data)
		}))
	};
}
