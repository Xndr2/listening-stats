/**
 * Reads text files out of a zip (Spotify's data export) with the browser's
 * own DecompressionStream: no zip library. Bounded on purpose: a crafted
 * file must not be able to inflate to gigabytes inside Spotify.
 */

/**
 * Files are unpacked one at a time and handed to the caller, so memory holds
 * one file, not the whole archive. Each file may unpack to at most
 * maxEntryBytes; the archive as a whole to at most maxTotalBytes.
 */
export const ZIP_LIMITS = { maxEntries: 200, maxEntryBytes: 200 * 1024 * 1024, maxTotalBytes: 2 * 1024 * 1024 * 1024 };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export class ZipError extends Error {}

interface Entry {
	name: string;
	method: number;
	compressedSize: number;
	size: number;
	offset: number;
}

function entries(buf: ArrayBuffer): Entry[] {
	const v = new DataView(buf);
	let eocd = -1;
	for (let p = buf.byteLength - 22; p >= Math.max(0, buf.byteLength - 22 - 0xffff); p--) {
		if (v.getUint32(p, true) === EOCD) {
			eocd = p;
			break;
		}
	}
	if (eocd < 0) throw new ZipError("This isn't a zip file.");
	const count = v.getUint16(eocd + 10, true);
	if (count > ZIP_LIMITS.maxEntries)
		throw new ZipError(`The zip has ${count} files; at most ${ZIP_LIMITS.maxEntries} are read.`);
	let p = v.getUint32(eocd + 16, true);
	const out: Entry[] = [];
	const dec = new TextDecoder();
	for (let i = 0; i < count; i++) {
		if (p + 46 > buf.byteLength || v.getUint32(p, true) !== CENTRAL) throw new ZipError("The zip file is damaged.");
		const nameLen = v.getUint16(p + 28, true);
		const e: Entry = {
			method: v.getUint16(p + 10, true),
			compressedSize: v.getUint32(p + 20, true),
			size: v.getUint32(p + 24, true),
			offset: v.getUint32(p + 42, true),
			name: dec.decode(new Uint8Array(buf, p + 46, Math.min(nameLen, buf.byteLength - p - 46))),
		};
		if (e.offset + 30 > buf.byteLength || e.offset + e.compressedSize > buf.byteLength) {
			throw new ZipError("The zip file is damaged.");
		}
		out.push(e);
		p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
	}
	return out;
}

async function inflate(data: Uint8Array, budget: { left: number; entryLeft: number }): Promise<Uint8Array> {
	const stream = (new Response(data as BodyInit).body as ReadableStream<Uint8Array>).pipeThrough(
		new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
	);
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		budget.left -= value.byteLength;
		budget.entryLeft -= value.byteLength;
		if (budget.left < 0 || budget.entryLeft < 0) {
			await reader.cancel();
			throw new ZipError("A file in the zip unpacks to more data than Listening Stats will read.");
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let o = 0;
	for (const c of chunks) {
		out.set(c, o);
		o += c.byteLength;
	}
	return out;
}

/** Each entry whose name passes `want`, unpacked and decoded one at a time, in archive order. */
export async function* zipTexts(
	buf: ArrayBuffer,
	want: (name: string) => boolean,
): AsyncGenerator<{ name: string; text: string }> {
	const v = new DataView(buf);
	const budget = { left: ZIP_LIMITS.maxTotalBytes, entryLeft: 0 };
	for (const e of entries(buf)) {
		if (!want(e.name)) continue;
		if (v.getUint32(e.offset, true) !== LOCAL) throw new ZipError("The zip file is damaged.");
		const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
		if (start + e.compressedSize > buf.byteLength) throw new ZipError("The zip file is damaged.");
		const raw = new Uint8Array(buf, start, e.compressedSize);
		budget.entryLeft = ZIP_LIMITS.maxEntryBytes;
		let bytes: Uint8Array;
		if (e.method === 0) {
			if (raw.byteLength > ZIP_LIMITS.maxEntryBytes) throw new ZipError("A file in the zip is too large to read.");
			bytes = raw;
		} else if (e.method === 8) bytes = await inflate(raw, budget);
		else throw new ZipError(`Unsupported compression in ${e.name}.`);
		yield { name: e.name, text: new TextDecoder().decode(bytes) };
	}
}
