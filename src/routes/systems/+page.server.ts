import { error } from '@sveltejs/kit';
import { discovered, jumpsFromBorder, mapView } from '#lib/situations.ts';
import {
	ledger,
	systemFacts,
	systemHistory,
	systemSpending,
	type Flow,
	type SystemData,
	type SystemPoint,
	type SystemSpend
} from '#lib/systems.ts';
import { display, mapFilter, systemView } from '#lib/server/settings.ts';
import { ownOnMap } from '#lib/mapLayers.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';

/** One variant of a system's money: without or with its colonies. */
type Money = { points: SystemPoint[]; spends: SystemSpend[]; flow: Flow };

// Our systems — and the discovered ones around them — with what each cost and earned.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.knownSystems !== null);
	const g = latest ? campaignGalaxy(latest.campaign) : null;
	const { wholeGalaxy: whole, unknownStars: stars } = display();
	const galaxy = discovered(g?.systems ?? [], { whole, stars });
	const beyond = jumpsFromBorder(galaxy);
	const game = getGameData();
	const data: SystemData = {
		costs: game.costs,
		depositCategory: game.depositCategory,
		defines: game.defines
	};
	// colonies by their planet's system; planets do not move, so the latest galaxy holds for all saves
	const colonySystem = new Map(
		(g?.systems ?? []).flatMap((s) => (s.bodies ?? []).map((p): [number, number] => [p.id, s.id]))
	);
	const money = (colonies: boolean) => {
		const history = systemHistory(snaps, data, colonies ? colonySystem : null);
		const spends = systemSpending(snaps, data, colonies);
		const flows = latest ? ledger(latest, data, colonies ? colonySystem : null) : new Map();
		return (id: number): Money | null =>
			history.has(id)
				? {
						points: history.get(id)!,
						spends: spends.filter((x) => x.systemId === id),
						flow: flows.get(id) ?? { income: {}, upkeep: {} }
					}
				: null;
	};
	const [plain, withColonies] = [money(false), money(true)];
	const owned = new Set((latest?.knownSystems ?? []).filter((k) => k.owned).map((k) => k.id));
	const starbase = new Map(
		(latest?.stations ?? []).map((st) => [
			st.systemId ?? latest?.knownSystems?.find((k) => k.name === st.system)?.id,
			st
		])
	);
	const rows = galaxy.map((s) => {
		const mine = owned.has(s.id);
		const st = starbase.get(s.id);
		return {
			systemId: s.id,
			name: s.name,
			owned: mine,
			ownerId: s.ownerId,
			beyond: beyond.get(s.id) ?? null,
			sector: s.sector ?? null,
			facts: systemFacts(s, data),
			level: mine ? (st?.level ?? null) : null,
			modules: mine ? (st?.modules ?? []) : [],
			buildings: mine ? (st?.buildings ?? []) : [],
			stations: (latest?.orbitalStations ?? []).filter((o) => o.systemId === s.id).length,
			colonies: (latest?.colonies ?? []).filter((c) => colonySystem.get(c.planetId) === s.id)
				.length,
			money: mine ? { plain: plain(s.id), colonies: withColonies(s.id) } : null
		};
	});
	return {
		...rest,
		seenAt: g?.date ?? null,
		hasStations: latest?.orbitalStations !== null && latest?.orbitalStations !== undefined,
		hasBudget: latest?.budget !== null && latest?.budget !== undefined,
		view: systemView(),
		// our stations and ships for the map, and which ships it draws (the map tab's setting)
		own: ownOnMap(b.latest),
		mapFilter: mapFilter(),
		// research, unity … at what they cost us: a system that makes only those can break even
		values: valuesOf(snaps),
		rows,
		names: game.names,
		territories: territoriesOf(snaps),
		systems: mapView(g?.systems ?? [], reveal())
	};
}
