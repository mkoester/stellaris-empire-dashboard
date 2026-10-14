import { inflateRawSync } from 'node:zlib';

// Minimal zip reader for .sav files (a zip of `meta` + `gamestate`). Reads the central directory,
// so it works whether or not the writer used data descriptors. Throws on a truncated file, which
// is what a save still being written looks like — callers retry.

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export function readZipEntry(zip: Uint8Array, name: string): Uint8Array {
	const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
	const eocd = findEocd(buf);
	const count = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(p) !== CENTRAL) throw new Error('zip: bad central directory');
		const method = buf.readUInt16LE(p + 10);
		const compressed = buf.readUInt32LE(p + 20);
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		const local = buf.readUInt32LE(p + 42);
		if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
			return extract(buf, local, compressed, method);
		}
		p += 46 + nameLen + extraLen + commentLen;
	}
	throw new Error(`zip: no entry ${name}`);
}

function findEocd(buf: Buffer): number {
	// The EOCD record is 22 bytes plus an optional comment of up to 64 KiB.
	for (let p = buf.length - 22; p >= Math.max(0, buf.length - 22 - 0xffff); p--) {
		if (buf.readUInt32LE(p) === EOCD) return p;
	}
	throw new Error('zip: no end-of-central-directory record (truncated?)');
}

function extract(buf: Buffer, local: number, size: number, method: number): Uint8Array {
	if (buf.readUInt32LE(local) !== LOCAL) throw new Error('zip: bad local header');
	const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
	const data = buf.subarray(start, start + size);
	if (method === 0) return data;
	if (method === 8) return inflateRawSync(data);
	throw new Error(`zip: unsupported compression method ${method}`);
}
