import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { patronCards } from '#lib/shroud.ts';

// The Shroud as the game's screen shows it: our attunement, the patrons we have contact with.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.kind === 'save');
	const shroud = s?.shroud ?? null;
	return {
		...rest,
		seenAt: s?.date ?? null,
		shroud,
		cards: shroud ? patronCards(shroud, getGameData().shroud) : [],
		// the compass marks only patrons we know, at their place
		known: shroud
			? shroud.patrons
					.filter((p) => p.contact === 'completed')
					.map((p) => ({
						key: p.patron,
						x: p.x,
						y: p.y,
						color: getGameData().shroud.patrons[p.patron]?.color ?? null
					}))
			: []
	};
}
