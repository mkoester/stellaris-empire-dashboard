import { error } from '@sveltejs/kit';
import { growthRows, queuedDistricts } from '#lib/growth.ts';
import { branch } from '#lib/server/branch.ts';
import { colonyDetails } from '#lib/server/planets.ts';

// Pop growth per colony as measured, with what feeds the game's planet capacity.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save') ?? null;
	return {
		...rest,
		rows: latest
			? growthRows(snaps, latest, (c) => {
					const caps = colonyDetails(c, latest)?.caps;
					if (!caps || caps.limit === null) return { free: null, blocked: null };
					return {
						free: Math.max(0, caps.limit - caps.built - queuedDistricts(c)),
						blocked: caps.limitCleared === null ? null : caps.limitCleared - caps.limit
					};
				})
			: [],
		housingKnown: latest?.colonies.some((c) => c.housing !== null) ?? false
	};
}
