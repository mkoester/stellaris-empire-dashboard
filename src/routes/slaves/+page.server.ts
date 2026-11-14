import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { viewedNoCheats } from '#lib/server/settings.ts';
import {
	allowsSlavery,
	citizenSpecies,
	offerHistory,
	othersSale,
	sales
} from '#lib/slaveMarket.ts';

// The Slave Market along the branch: what is for sale now, what was offered before and — with the
// companion mod — every sale. Sales between two other empires are intel the game does not show
// us: barred in multiplayer and Ironman, as the `intel` switches are.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const save = snaps.findLast((s) => s.kind === 'save');
	const us = save?.empireName ?? '';
	const barred = viewedNoCheats(getDb());
	const all = sales(snaps);
	return {
		...rest,
		offers: offerHistory(snaps),
		sales: barred ? all.filter((s) => !othersSale(s, us)) : all,
		hiddenSales: barred ? all.filter((s) => othersSale(s, us)).length : 0,
		barred,
		us,
		ours: [...(save ? citizenSpecies(save) : [])],
		slaver: save ? allowsSlavery(save) : false,
		bans: save?.slaveTradeBans ?? null,
		// the mod logs on this branch at all (any event line): without it no buyer is known
		mod: snaps.some((s) => (s.logEvents?.length ?? 0) > 0)
	};
}
