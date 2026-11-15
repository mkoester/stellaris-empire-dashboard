import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { bonusCards } from '#lib/server/bonusPiles.ts';
import { branch } from '#lib/server/branch.ts';

// What one more bonus is worth now: every pile where bonuses add up, its lines and what it acts on.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return { ...rest, bonuses: bonusCards({ snaps, ...rest }, getGameData(), getExplanations()) };
}
