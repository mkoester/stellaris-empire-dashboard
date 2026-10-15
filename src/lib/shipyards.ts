import type { MegaShipyard, Station } from './types.ts';

// Where capital ships can be built, per titan_/colossus_/juggernaut_possible_construction
// (common/scripted_triggers/07_scripted_triggers_ships.txt, 4.5.2): a citadel with Capital
// Assembly Yards, an arkship with its capital shipyard module, or a finished Mega Shipyard —
// and in every case the class's tech (ship_sizes `prerequisites`).

export const CAPITAL_SHIPS = [
	{ size: 'titan', tech: 'tech_titans' },
	{ size: 'colossus', tech: 'tech_colossus' },
	{ size: 'juggernaut', tech: 'tech_juggernaut' }
];

/** What a starbase lacks to build capital ships; empty when it can. */
export function capitalYardMissing(s: Station): string[] {
	if (s.arkship)
		return s.modules.includes('arkship_capital_shipyard')
			? []
			: ['arkship capital shipyard module'];
	return [
		...(s.level === 'citadel' ? [] : ['citadel']),
		...(s.buildings.includes('capital_yards') ? [] : ['capital assembly yards'])
	];
}

export const megaShipyardDone = (m: MegaShipyard) =>
	m.type === 'mega_shipyard_3' || m.type === 'mega_shipyard_restored';

/** Stage of a Mega Shipyard for display: "stage 1 of 3", "complete", "ruined". */
export function megaStage(type: string): string {
	const n = /^mega_shipyard_(\d)$/.exec(type)?.[1];
	if (n === '3') return 'complete';
	if (n !== undefined) return `stage ${n} of 3`;
	return type.replace(/^mega_shipyard_/, '').replaceAll('_', ' ');
}
