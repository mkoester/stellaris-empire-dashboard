// Localisation files of the active mods (`<mod>/localisation/english/*.yml`): the names the game
// shows for what a mod adds — its systems, megastructures, techs, special projects. The data DB is
// extracted from the game's own files, so without these a mod's content shows its raw keys.

/**
 * One localisation file: `key:0 "text"` (the number is optional) per line, after `l_english:`.
 * Colour codes (`§Y…§!`) are dropped, `\"` unescaped, `\n` read as a space; `#` starts a comment
 * outside the text.
 */
export function parseLocalisation(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
		const m = /^\s*([\w.-]+):\d*\s*"(.*)"\s*(#.*)?$/.exec(line);
		if (!m) continue;
		out[m[1]] = m[2]
			.replace(/\\"/g, '"')
			.replace(/\\n/g, ' ')
			.replace(/§[A-Za-z!]/g, '')
			.trim();
	}
	return out;
}

/**
 * The files merged in load order (later wins, as in the game), each `$key$` reference to another
 * key of the map filled in once; engine placeholders (`$NAME$` with no such key) stay.
 */
export function mergeLocalisation(files: Record<string, string>[]): Record<string, string> {
	const merged: Record<string, string> = Object.assign({}, ...files);
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(merged))
		out[k] = v.replace(/\$([\w.-]+)\$/g, (all, ref: string) =>
			ref !== k && merged[ref] !== undefined ? merged[ref] : all
		);
	return out;
}
