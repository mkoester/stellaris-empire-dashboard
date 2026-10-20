import { updates } from '#lib/server/app.ts';
import type { Tick } from '#lib/types.ts';

// Server-sent events: one `update` per ingested save (its node id), or `refreshed` once stored
// saves were read again, so open pages reload their data; and a `tick` event (JSON) with each day's
// stockpile from the companion mod, which reloads nothing.
export function GET({ request }) {
	let onUpdate: (id: number | 'refreshed') => void;
	let onTick: (t: Tick) => void;
	const stream = new ReadableStream({
		start(controller) {
			const send = (data: string) => controller.enqueue(`data: ${data}\n\n`);
			onUpdate = (id) => send(String(id));
			onTick = (t) => controller.enqueue(`event: tick\ndata: ${JSON.stringify(t)}\n\n`);
			updates.on('update', onUpdate);
			updates.on('tick', onTick);
			request.signal.addEventListener('abort', () => {
				updates.off('update', onUpdate);
				updates.off('tick', onTick);
				controller.close();
			});
		},
		cancel() {
			updates.off('update', onUpdate);
			updates.off('tick', onTick);
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
	});
}
