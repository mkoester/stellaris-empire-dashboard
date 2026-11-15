import { redirect } from '@sveltejs/kit';

// The tab was called situations until 2026-11-15, a game term for one of its panels: old links
// and bookmarks land on its new name, the query (`?node=`) kept.
export function load({ url }) {
	redirect(308, `/frontier${url.search}`);
}
