import { error } from '@sveltejs/kit';
import { contractMarks } from '#lib/contracts.ts';
import { mapView } from '#lib/situations.ts';
import { branch } from '#lib/server/branch.ts';
import { contractsAt } from '#lib/server/contracts.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';

// Nomads contracts the player may see at the branch's latest save (#lib/contracts.ts).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const shown = display(); // once per request
	const c = contractsAt(snaps, shown);
	const s = snaps.findLast((x) => x.contracts !== null);
	const g = s ? campaignGalaxy(s.campaign) : null;
	return {
		...rest,
		contracts: c,
		marks: contractMarks(c.rows, c.systemNames),
		spoilers: shown.contractSpoilers,
		all: shown.contractsAll,
		systems: mapView(g?.systems ?? [], reveal()),
		territories: territoriesOf(snaps)
	};
}
