import { redirect } from '@sveltejs/kit';

// Colony pages were /planet/<id> before they were named for what they show; keeps old links and
// open panes working.
export function load({ params, url }) {
	redirect(308, `/colony/${params.id}${url.search}`);
}
