import type { RemoteHop } from "../portfolio/remote";
import { fetchRemote, remoteDeadline, RemoteFetchError, remoteUrl } from "../portfolio/remote";
import { uploadFile } from "../storage/service";

/**
 * Copying a company's logo from the posting page the browser extension saved into the account's uploads
 * (.agents/docs/plans/plugin-browser/02-teknis.md §19.4). Job board picture addresses expire, refuse other sites, and
 * would tell the board each time the tracker is opened, so the picture is copied once instead of linked.
 *
 * Any public https host may serve a logo (each board uses its own image service), so the guard is the safe remote
 * reader's: public addresses only, every redirect checked again, a deadline, and a size cap. Only PNG, JPEG and WebP
 * are kept, recognised by their own bytes (an SVG can carry script, so it is refused rather than sanitised). The bytes
 * are stored as they are: 200 KB bounds them, and the web draws them small.
 */

export const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_DEADLINE_MS = 8_000;

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** The picture's real type from its first bytes, when it is one a logo may be. */
export function logoType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
	const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
	if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
	if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
	return null;
}

/** Why a logo was not copied; saving the application never fails because of it. */
type LogoProblem = "unsafe-url" | "unreachable" | "too-large" | "wrong-type";

export type CopiedLogo = { ok: true; url: string } | { ok: false; reason: LogoProblem };

export type DownloadedLogo =
	| { ok: true; bytes: Uint8Array; contentType: "image/png" | "image/jpeg" | "image/webp" }
	| { ok: false; reason: LogoProblem };

/** Downloads one logo from a public https address, checked as above; why it was skipped when it wasn't. */
export async function downloadLogo(
	address: string,
	options: { signal?: AbortSignal | undefined; hop?: RemoteHop | undefined } = {},
): Promise<DownloadedLogo> {
	const url = remoteUrl(address);
	if (!url || url.protocol !== "https:") return { ok: false, reason: "unsafe-url" };

	let body: Awaited<ReturnType<typeof fetchRemote>>;
	try {
		body = await fetchRemote(url, {
			signal: remoteDeadline(LOGO_DEADLINE_MS, options.signal),
			accept: "image/png,image/jpeg,image/webp;q=0.9,image/*;q=0.1",
			// Storage buckets often serve pictures as plain bytes; the bytes themselves are checked below either way.
			acceptsType: (type) =>
				LOGO_TYPES.has(type) || type === "application/octet-stream" || type === "binary/octet-stream",
			maxBytes: MAX_LOGO_BYTES,
			overflow: "refuse",
			hop: options.hop,
		});
	} catch (error) {
		options.signal?.throwIfAborted();
		if (error instanceof RemoteFetchError) {
			if (error.reason === "too-large" || error.reason === "wrong-type" || error.reason === "unsafe-url")
				return { ok: false, reason: error.reason };
		}
		return { ok: false, reason: "unreachable" };
	}

	const contentType = logoType(body.bytes);
	return contentType ? { ok: true, bytes: body.bytes, contentType } : { ok: false, reason: "wrong-type" };
}

/** Downloads one logo and stores it under the account's uploads; returns its address there, or why it was skipped. */
export async function copyCompanyLogo(
	userId: string,
	address: string,
	options: { signal?: AbortSignal | undefined; hop?: RemoteHop | undefined } = {},
): Promise<CopiedLogo> {
	const logo = await downloadLogo(address, options);
	if (!logo.ok) return logo;
	const stored = await uploadFile({ userId, data: logo.bytes, contentType: logo.contentType });
	return { ok: true, url: stored.url };
}
