import { error } from '@sveltejs/kit';
import { empireData } from '#lib/server/empire.ts';
import { tabs } from '#lib/server/settings.ts';

// A custom tab: its own pick of the empire panels.
export function load({ url, params }) {
	const tab = tabs().find((t) => t.id === params.id);
	if (!tab) error(404, 'no such tab');
	return { tab, empire: empireData(url) };
}
