import { describe, expect, it, vi } from 'vitest';
import type { LiveEvent } from './eventsWorker.ts';
import { createHub } from './live.ts';

describe('createHub', () => {
	const setup = () => {
		let dispatch: (e: LiveEvent) => void = () => {};
		const close = vi.fn();
		const connect = vi.fn((d: (e: LiveEvent) => void) => {
			dispatch = d;
			return close;
		});
		return { on: createHub(connect), connect, close, send: (e: LiveEvent) => dispatch(e) };
	};

	it('opens one connection for every subscription, and closes it with the last', () => {
		const { on, connect, close } = setup();
		const a = on('message', () => {});
		const b = on('tick', () => {});
		const c = on('loaded', () => {});
		expect(connect).toHaveBeenCalledTimes(1);
		a();
		b();
		expect(close).not.toHaveBeenCalled();
		c();
		expect(close).toHaveBeenCalledTimes(1);
		on('message', () => {});
		expect(connect).toHaveBeenCalledTimes(2);
	});

	it('hands each event to the handlers of its type only', () => {
		const { on, send } = setup();
		const message = vi.fn();
		const tick = vi.fn();
		on('message', message);
		const off = on('tick', tick);
		send({ type: 'message', data: '12' });
		send({ type: 'tick', data: '{}' });
		off();
		send({ type: 'tick', data: '{}' });
		expect(message).toHaveBeenCalledWith('12');
		expect(tick).toHaveBeenCalledTimes(1);
	});
});
