// The page's section bar (`PageNav.svelte`): an id for a heading that has none. Pure.

/** "Still to gain" → "sec-still-to-gain", numbered where `taken` says the page has it already. */
export function headingId(text: string, taken: (id: string) => boolean): string {
	const base = `sec-${
		text
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'section'
	}`;
	let id = base;
	for (let n = 2; taken(id); n++) id = `${base}-${n}`;
	return id;
}
