// The one connection to `/api/events` for every tab of this browser (a SharedWorker, started by
// `#lib/live.ts`). Browsers give a host 6 HTTP/1.1 connections; three server-event streams per
// tab, as each page opened before, held them all with two tabs open, and every tab click then
// waited for one (0.1.17, 2026-11-15). Each event goes to every tab as `{ type, data }`.
// The worker outlives a dashboard restart while any tab is open: `followStream` reconnects.

import { followStream } from './liveStream.ts';

export type LiveEvent = { type: 'message' | 'tick' | 'loaded'; data: string };

// the worker's own scope, without pulling the webworker lib into the DOM-typed project
const scope = self as unknown as {
	onconnect: ((e: MessageEvent) => void) | null;
};

const ports = new Set<MessagePort>();
followStream(
	() => new EventSource('/api/events'),
	(e) => {
		for (const p of ports) p.postMessage(e);
	}
);

scope.onconnect = (e) => {
	const port = e.ports[0];
	ports.add(port);
	// a closing tab says so (`live.ts`); one that crashed only stops listening
	port.onmessage = (m) => {
		if (m.data === 'close') ports.delete(port);
	};
	port.start();
};
