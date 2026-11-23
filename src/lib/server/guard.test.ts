import { describe, expect, it } from 'vitest';
import { localName, loopback, refusal, type Asked } from './guard.ts';

const asked = (a: Partial<Asked> = {}): Asked => ({
	host: '127.0.0.1:5174',
	client: '127.0.0.1',
	method: 'GET',
	path: '/',
	origin: null,
	self: 'http://127.0.0.1:5174',
	...a
});

describe('localName', () => {
	it('takes the names only this computer or its network can give', () => {
		for (const h of [
			'localhost',
			'localhost:5174',
			'127.0.0.1:5174',
			'192.168.1.20:5174',
			'[::1]:5174',
			'[fe80::1]',
			'gamepc:5174',
			'gamepc.local:5174',
			'LOCALHOST'
		])
			expect(localName(h), h).toBe(true);
	});

	it('refuses a name a public DNS can point here', () => {
		for (const h of ['evil.example:5174', 'evil.example', '127.0.0.1.evil.example', ''])
			expect(localName(h), h).toBe(false);
	});
});

describe('loopback', () => {
	it('knows this computer by its addresses', () => {
		expect(loopback('127.0.0.1')).toBe(true);
		expect(loopback('::1')).toBe(true);
		expect(loopback('::ffff:127.0.0.1')).toBe(true);
		expect(loopback('192.168.1.20')).toBe(false);
		expect(loopback('::ffff:192.168.1.20')).toBe(false);
	});
});

describe('refusal', () => {
	it('lets the dashboard’s own pages read and write', () => {
		expect(refusal(asked())).toBeNull();
		expect(
			refusal(asked({ method: 'PUT', path: '/api/settings', origin: 'http://127.0.0.1:5174' }))
		).toBeNull();
		// no Origin: not a browser's cross-site request
		expect(refusal(asked({ method: 'POST', path: '/api/plan' }))).toBeNull();
	});

	it('refuses a rebound name, reading included', () => {
		const a = asked({ host: 'evil.example:5174', self: 'http://evil.example:5174' });
		expect(refusal(a)).toMatch(/not served as evil\.example/);
		expect(refusal({ ...a, method: 'POST', origin: 'http://evil.example:5174' })).not.toBeNull();
	});

	it('refuses a write from another site, whatever its content type', () => {
		expect(
			refusal(asked({ method: 'POST', path: '/api/campaigns', origin: 'https://evil.example' }))
		).toMatch(/cross-site/);
		expect(
			refusal(asked({ method: 'DELETE', path: '/api/x', origin: 'http://localhost:5174' }))
		).toMatch(/cross-site/);
	});

	it('keeps the folders and the campaigns to this computer', () => {
		const lan = {
			host: '192.168.1.20:5174',
			self: 'http://192.168.1.20:5174',
			origin: 'http://192.168.1.20:5174',
			client: '192.168.1.77'
		};
		for (const path of ['/setup', '/api/campaigns'])
			expect(refusal(asked({ ...lan, method: 'POST', path })), path).toMatch(/only possible/);
		// reading them, and every other change, stays possible on the network
		expect(refusal(asked({ ...lan, path: '/setup' }))).toBeNull();
		expect(refusal(asked({ ...lan, method: 'PUT', path: '/api/settings' }))).toBeNull();
		expect(
			refusal(asked({ ...lan, method: 'POST', path: '/setup', client: '127.0.0.1' }))
		).toBeNull();
	});

	it('a client without an address (its connection closed) is not this computer', () => {
		expect(refusal(asked({ method: 'POST', path: '/setup', client: '' }))).toMatch(/only possible/);
		expect(refusal(asked({ client: '' }))).toBeNull();
	});
});
