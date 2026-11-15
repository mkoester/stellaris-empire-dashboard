// The one connection to `/api/events` for every tab of this browser (a SharedWorker, started by
// `#lib/live.ts`). Browsers give a host 6 HTTP/1.1 connections; three server-event streams per
// tab, as each page opened before, held them all with two tabs open, and every tab click then
// waited for one (0.1.17, 2026-11-15). Each event goes to every tab as `{ type, data }`.

export type LiveEvent = { type: 'message' | 'tick' | 'loaded'; data: string };

// the worker's own scope, without pulling the webworker lib into the DOM-typed project
const scope = self as unknown as {
	onconnect: ((e: MessageEvent) => void) | null;
};

const ports = new Set<MessagePort>();
const events = new EventSource('/api/events');
const send = (type: LiveEvent['type']) => (e: MessageEvent<string>) => {
	for (const p of ports) p.postMessage({ type, data: e.data } satisfies LiveEvent);
};
events.onmessage = send('message');
events.addEventListener('tick', send('tick'));
events.addEventListener('loaded', send('loaded'));

scope.onconnect = (e) => {
	const port = e.ports[0];
	ports.add(port);
	// a closing tab says so (`live.ts`); one that crashed only stops listening
	port.onmessage = (m) => {
		if (m.data === 'close') ports.delete(port);
	};
	port.start();
};
