import { updates } from '#lib/server/app.ts';
import type { Tick } from '#lib/types.ts';

// Server-sent events: one `update` per ingested save (its node id), or `refreshed` once stored
// saves were read again, so open pages reload their data; and a `tick` event (JSON) with each day's
// stockpile from the companion mod, which reloads nothing; `loaded` when the player loaded a save
// the dashboard knows (the layout then offers to show it).
export function GET({ request }) {
	let onUpdate: (id: number | 'refreshed') => void;
	let onTick: (t: Tick) => void;
	let onLoaded: () => void;
	const stream = new ReadableStream({
		start(controller) {
			const send = (data: string) => controller.enqueue(`data: ${data}\n\n`);
			onUpdate = (id) => send(String(id));
			onTick = (t) => controller.enqueue(`event: tick\ndata: ${JSON.stringify(t)}\n\n`);
			onLoaded = () => controller.enqueue(`event: loaded\ndata: \n\n`);
			updates.on('update', onUpdate);
			updates.on('tick', onTick);
			updates.on('loaded', onLoaded);
			request.signal.addEventListener('abort', () => {
				updates.off('update', onUpdate);
				updates.off('tick', onTick);
				updates.off('loaded', onLoaded);
				controller.close();
			});
		},
		cancel() {
			updates.off('update', onUpdate);
			updates.off('tick', onTick);
			updates.off('loaded', onLoaded);
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
	});
}
