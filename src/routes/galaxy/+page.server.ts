import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { difficulties, difficultyCard } from '#lib/server/difficulty.ts';
import { branch } from '#lib/server/branch.ts';
import { setupGroups } from '#lib/galaxySetup.ts';

// The settings the galaxy was created with, from the branch's latest save that holds them, each
// marked where it differs from the setup screen's default for this galaxy size; and what every
// difficulty does (`#lib/server/difficulty.ts`).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.kind === 'save' && x.galaxySetup);
	const data = getGameData();
	const scale = s?.galaxySetup?.technology_difficulty_scale;
	const all = difficulties(typeof scale === 'string' ? scale : null);
	const current = all.find((d) => d.key === s?.galaxySetup?.difficulty) ?? null;
	return {
		...rest,
		seenAt: s?.date ?? null,
		groups: s?.galaxySetup
			? setupGroups(s.galaxySetup, data.precursors, {
					scenarios: data.setupScenarios,
					defines: data.defines
				})
			: [],
		difficulties: all,
		difficultyCard: current ? difficultyCard(current) : null
	};
}
