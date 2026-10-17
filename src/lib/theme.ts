import type { Theme } from './settings.ts';

// Client side of the theme: the class on <html> (see layout.css) and a notice for canvases, which
// do not restyle themselves.
const EVENT = 'themechange';
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(theme: Theme) {
	document.documentElement.className = theme;
	dispatchEvent(new Event(EVENT));
}

export function isDark(): boolean {
	const cls = document.documentElement.className;
	return cls === 'dark' || (cls !== 'light' && darkQuery().matches);
}

/** Calls `redraw` whenever the effective theme may have changed; returns the unsubscribe. */
export function onThemeChange(redraw: () => void): () => void {
	const q = darkQuery();
	addEventListener(EVENT, redraw);
	q.addEventListener('change', redraw);
	return () => {
		removeEventListener(EVENT, redraw);
		q.removeEventListener('change', redraw);
	};
}
