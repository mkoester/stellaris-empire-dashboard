import { getRequestEvent } from '$app/server';

// The one place that reads the request being answered without being handed it: the settings and
// the game data follow the campaign a page views (`?node=`), and their getters are called from
// every loader. Everything else takes what it needs as arguments.

/** The request being answered, null outside one (the watcher, the start, tests). */
export function currentRequest(): ReturnType<typeof getRequestEvent> | null {
	try {
		return getRequestEvent();
	} catch {
		return null;
	}
}

/** The node a URL names (`?node=`), null without one. */
export function nodeParam(url: URL): number | null {
	const v = url.searchParams.get('node');
	return v === null || v === '' ? null : Number(v);
}

/** The node the request being answered names, null without one or outside a request. */
export function requestedNode(): number | null {
	const event = currentRequest();
	return event ? nodeParam(event.url) : null;
}
