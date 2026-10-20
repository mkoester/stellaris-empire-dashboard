import { updates } from '#lib/server/app.ts';

// Server-sent events: one `update` per ingested save (its node id), or `refreshed` once stored
// saves were read again, so open pages reload their data.
export function GET({ request }) {
	let onUpdate: (id: number | 'refreshed') => void;
	const stream = new ReadableStream({
		start(controller) {
			const send = (data: string) => controller.enqueue(`data: ${data}\n\n`);
			onUpdate = (id) => send(String(id));
			updates.on('update', onUpdate);
			request.signal.addEventListener('abort', () => {
				updates.off('update', onUpdate);
				controller.close();
			});
		},
		cancel() {
			updates.off('update', onUpdate);
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
	});
}
