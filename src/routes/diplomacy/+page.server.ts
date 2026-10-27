import { error } from '@sveltejs/kit';
import { ethicsHistory, diplomacyView as view } from '#lib/diplomacy.ts';
import { mapView } from '#lib/situations.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { diplomacyView, display } from '#lib/server/settings.ts';

// Every empire we know and the relations between them, as our intel shows them — what it no
// longer shows marked unverified since it last did (#lib/diplomacy.ts); everything with the
// `diplomacyAll` cheat. Hidden facts never leave the server.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const cheat = display().diplomacyAll;
	const d = view(snaps, data.flagColors, cheat);
	const s = snaps.findLast((x) => x.firstContacts !== null);
	const g = s ? (campaignGalaxy(s.campaign)?.systems ?? []) : [];
	const byId = new Map(g.map((x) => [x.id, x]));
	const capitals = Object.fromEntries(
		(d?.nodes ?? []).flatMap((n) => {
			const c = n.capital ? byId.get(n.capital.value) : undefined;
			return c ? [[n.id, c.id]] : [];
		})
	);
	const shown = mapView(
		g,
		reveal(),
		(s?.firstContacts ?? []).map((c) => c.systemId)
	);
	const onMap = new Set(shown.map((x) => x.id));
	return {
		...rest,
		cheat,
		diplomacy: d,
		capitals, // empire → its capital system, where our intel knows it
		// the map: what we discovered, plus each known capital (the intel names it), faint
		systems: [
			...shown,
			...Object.values(capitals)
				.filter((id) => !onMap.has(id))
				.map((id) => {
					const c = byId.get(id)!;
					return { id, name: c.name, x: c.x, y: c.y, lanes: [], known: false };
				})
		],
		territories: territoriesOf(snaps),
		view: diplomacyView(),
		names: data.identityNames,
		// ethics: their axes, the federation defines, what intel saw change, the ethics' popups
		ethics: {
			axes: data.ethicAxes,
			defines: Object.fromEntries(
				Object.entries(data.defines).filter(([k]) => k.startsWith('FEDERATION_'))
			)
		},
		ethicsHistory: ethicsHistory(snaps, cheat),
		authorities: data.authorities,
		explain: pick(
			getExplanations(),
			Object.keys(data.ethicAxes).map((k) => `ethic:${k}`)
		)
	};
}
