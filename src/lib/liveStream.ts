import type { LiveEvent } from './eventsWorker.ts';

/** The part of an `EventSource` the stream uses. */
export type Source = {
	readonly readyState: number;
	onopen: ((e: Event) => void) | null;
	onerror: ((e: Event) => void) | null;
	onmessage: ((e: MessageEvent<string>) => void) | null;
	addEventListener(type: 'tick' | 'loaded', h: (e: MessageEvent<string>) => void): void;
	close(): void;
};

/** `EventSource.CLOSED`: the browser has given up and will not reconnect by itself. */
const CLOSED = 2;
export const RETRY_MS = 5000;

/**
 * Follows the server events until the returned stop. The browser reconnects an `EventSource`
 * after a network error, but drops it for good on an answer that is not an event stream — a
 * restarting dashboard once gave one, and the tabs stopped following the game until all were
 * closed (2026-11-27). Then a new source opens after `RETRY_MS`. Back after any loss, it hands on
 * `refreshed`: the pages reload, since saves may have been read meanwhile.
 */
export function followStream(
	open: () => Source,
	deliver: (e: LiveEvent) => void,
	later: (f: () => void, ms: number) => unknown = setTimeout,
	cancel: (t: unknown) => void = (t) => clearTimeout(t as ReturnType<typeof setTimeout>)
) {
	let lost = false;
	let source: Source;
	let retry: unknown;
	const connect = () => {
		const s = (source = open());
		s.onopen = () => {
			if (lost) deliver({ type: 'message', data: 'refreshed' });
			lost = false;
		};
		s.onerror = () => {
			lost = true;
			if (s.readyState === CLOSED) retry = later(connect, RETRY_MS);
		};
		s.onmessage = (e) => deliver({ type: 'message', data: e.data });
		for (const type of ['tick', 'loaded'] as const)
			s.addEventListener(type, (e) => deliver({ type, data: e.data }));
	};
	connect();
	return () => {
		cancel(retry);
		source.close();
	};
}
