// Starts the packaged dashboard (scripts/package.mjs builds the folder around this file): names
// the bundled extractor and its Python, serves the app on a free local port and opens the
// browser. start.bat / start.command / start.sh run it with the bundled Node. `--lan` also serves other devices
// on the local network (a tablet as the second screen).
//
// It runs its own HTTP server around adapter-node's handler rather than the adapter's
// `index.js`: without ORIGIN the adapter takes every request for https, and SvelteKit then
// rejects the forms (/setup, /timeline) as cross-site. Here every request is plain http, said so
// in a header the adapter is told to read — whatever host the browser used (127.0.0.1,
// localhost, a LAN address).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const win = process.platform === 'win32';
const mac = process.platform === 'darwin';
const lan = process.argv.includes('--lan');
const PROTO = 'x-dashboard-proto';

process.env.PROTOCOL_HEADER = PROTO;
process.env.STELLARIS_EXTRACTOR ||= join(here, 'extractor', 'stellaris-extract.py');
// Windows and macOS bring their own Python, Linux uses the system's
process.env.STELLARIS_PYTHON ||= win
	? join(here, 'python', 'python.exe')
	: mac
		? join(here, 'python', 'bin', 'python3')
		: 'python3';

/** Listens on the first free port from `from`. */
async function listen(server, from, host) {
	for (let port = from; port < from + 20; port++) {
		const ok = await new Promise((resolve, reject) => {
			const fail = (e) => (e.code === 'EADDRINUSE' ? resolve(false) : reject(e));
			server.once('error', fail).listen(port, host, () => {
				server.off('error', fail);
				resolve(true);
			});
		});
		if (ok) return port;
	}
	throw new Error(`no free port in ${from}–${from + 19}`);
}

function openBrowser(url) {
	const [cmd, args] = win ? ['cmd', ['/c', 'start', '', url]] : [mac ? 'open' : 'xdg-open', [url]];
	spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true })
		.on('error', () => console.log(`Open ${url} in your browser.`))
		.unref();
}

// Ctrl+C, closing the window (SIGHUP on all three systems) or a kill: stop serving, then let the
// app store the save it is reading and close its DB (`sveltekit:shutdown`, adapter-node's
// event). The process then ends by itself; Windows kills a closed console's process ~10 s later
// anyway, so this gives up after 5. A second Ctrl+C stops at once.
let server;
let stopping = false;
function shutdown() {
	if (stopping) process.exit(1);
	stopping = true;
	console.log('Stopping …');
	setTimeout(() => process.exit(0), 5000).unref();
	if (!server) return; // still starting: stopped once started, below
	server.close(() => process.emit('sveltekit:shutdown'));
	server.closeAllConnections(); // open pages hold an event stream that never goes idle
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', ...(win ? ['SIGBREAK'] : [])])
	process.on(signal, shutdown);

async function serve(handler) {
	server = createServer((req, res) => {
		req.headers[PROTO] = 'http';
		handler(req, res);
	});
	const port = await listen(
		server,
		Number(process.env.PORT) || 5174,
		lan ? '0.0.0.0' : '127.0.0.1'
	);
	const url = `http://127.0.0.1:${port}/`;
	console.log(`Stellaris Empire Dashboard — ${url}`);
	if (lan) console.log(`Also on this computer's network address, port ${port}.`);
	console.log(win || mac ? 'Close this window to stop it.' : 'Press Ctrl+C to stop it.');
	openBrowser(url);
}

// the app starts (game data, saves) while the handler module loads
console.log('Starting the Stellaris Empire Dashboard …');
const { handler } = await import(pathToFileURL(join(here, 'app', 'handler.js')).href);
if (stopping) process.emit('sveltekit:shutdown');
else await serve(handler);
