import { error, json } from '@sveltejs/kit';
import { getExplanations } from '#lib/server/app.ts';

// One popup card by its ref (`tech:<key>`, …), for `InfoPopup`'s `ref`: fetched on first hover, so
// a page that names many techs (the planner's history, the events) need not carry every card.
export function GET({ url }) {
	const ref = url.searchParams.get('ref') ?? '';
	const card = getExplanations()[ref];
	if (!card) error(404, 'no such card');
	return json(card);
}
