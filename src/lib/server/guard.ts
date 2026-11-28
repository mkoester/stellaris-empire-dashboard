// Who may ask what: the dashboard has no login, so the address a request came to and from is all
// that tells a page of the dashboard from a foreign website or another device.
// - A website that points its own name at 127.0.0.1 (DNS rebinding) would otherwise be the
//   dashboard's own origin: only names no public DNS can hold are served.
// - SvelteKit's own cross-site check covers the built app only, not `vite dev`.
// - With `--lan` every device on the network reaches it: the folders (/setup) and a campaign's
//   history can only be changed from the computer the dashboard runs on.

export type Asked = {
	/** the `Host` the request named, port included (`url.host`) */
	host: string;
	/** the address it came from */
	client: string;
	method: string;
	path: string;
	/** the `Origin` header, null without one */
	origin: string | null;
	/** the origin the request was served on (`url.origin`) */
	self: string;
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** `host` without its port; an IPv6 literal keeps its brackets. */
export const hostname = (host: string) => host.replace(/:\d+$/, '').toLowerCase();

/**
 * Whether `Host` is a name only this computer or its network can give: `localhost`, an IP
 * address, a name without a dot or one under `.local` (mDNS).
 */
export function localName(host: string): boolean {
	const name = hostname(host);
	return (
		name === 'localhost' ||
		IPV4.test(name) ||
		(name.startsWith('[') && name.endsWith(']')) ||
		(name !== '' && !name.includes('.')) ||
		name.endsWith('.local')
	);
}

/** Whether the request came from this computer. */
export const loopback = (client: string) =>
	client === '::1' || /^(::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(client);

const READING = new Set(['GET', 'HEAD', 'OPTIONS']);

/** What only the computer the dashboard runs on may change. */
const LOCAL_ONLY = ['/setup', '/api/campaigns'];

/**
 * Whether a request is sent to /setup because the dashboard is not running yet. The event stream
 * never is: a browser drops an `EventSource` for good when the answer is not `text/event-stream`,
 * and the open tabs reconnecting at a restart arrive while the dashboard is still starting — the
 * pages then stopped following the game until every tab was closed (2026-11-27).
 */
export const leadsToSetup = (running: boolean, path: string) =>
	!running && !path.startsWith('/setup') && path !== '/api/events';

/** Why the request is refused, or null when it may pass. */
export function refusal(a: Asked): string | null {
	if (!localName(a.host)) return `this dashboard is not served as ${hostname(a.host)}`;
	if (READING.has(a.method)) return null;
	if (a.origin !== null && a.origin !== a.self) return 'cross-site requests are refused';
	if (LOCAL_ONLY.includes(a.path) && !loopback(a.client))
		return 'only possible on the computer the dashboard runs on';
	return null;
}
