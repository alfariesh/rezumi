import type { RemoteHop } from "../../portfolio/remote";
import { ORPCError } from "@orpc/server";
import { env } from "@rezumi/env/server";
import { fetchRemote, remoteDeadline, RemoteFetchError, remoteUrl } from "../../portfolio/remote";
import { isImageFile, processImageForUpload, uploadFile } from "../../storage/service";
import { sourceErrors } from "./errors";

/**
 * Keeping a photo a source found (`adoptPhoto`): the picture is copied from the site that serves it into the
 * account's uploads, the way an uploaded resume photo is stored, so the Profile never points at an address that
 * expires or tracks. Only the hosts the sources and sign-in providers serve photos from are asked; the app's own
 * uploads come back as they are.
 */

/** Hosts photos come from: LinkedIn, GitHub and Google (sign-in photos). */
export function isPhotoHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	return (
		host === "media.licdn.com" || host === "avatars.githubusercontent.com" || host.endsWith(".googleusercontent.com")
	);
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_DEADLINE_MS = 15_000;

/** The app's own upload address (absolute on this app, or a path), which needs no copy. */
function ownUpload(input: string): boolean {
	let url: URL;
	try {
		url = new URL(input, env.APP_URL);
	} catch {
		return false;
	}
	return url.origin === new URL(env.APP_URL).origin && /^\/(?:api\/)?uploads\//.test(url.pathname);
}

/** Copies a source's photo into the account's uploads and returns its address there. */
export async function adoptPhoto(
	userId: string,
	input: string,
	options: { signal?: AbortSignal | undefined; hop?: RemoteHop | undefined } = {},
): Promise<{ url: string }> {
	const address = input.trim();
	if (ownUpload(address)) return { url: address };

	const url = remoteUrl(address, isPhotoHost);
	if (!url || url.protocol !== "https:")
		throw sourceErrors.invalid("Only photos from LinkedIn, GitHub or Google can be copied. Upload the photo instead.");

	let body: Awaited<ReturnType<typeof fetchRemote>>;
	try {
		body = await fetchRemote(url, {
			signal: remoteDeadline(PHOTO_DEADLINE_MS, options.signal),
			accept: "image/*",
			acceptsType: isImageFile,
			maxBytes: MAX_PHOTO_BYTES,
			overflow: "refuse",
			isAllowedHost: isPhotoHost,
			hop: options.hop,
		});
	} catch (error) {
		options.signal?.throwIfAborted();
		if (error instanceof RemoteFetchError && (error.reason === "wrong-type" || error.reason === "too-large"))
			throw sourceErrors.invalid("That address isn't a photo that can be used. Upload the photo instead.");
		if (error instanceof RemoteFetchError && error.reason === "unsafe-url")
			throw sourceErrors.invalid(
				"Only photos from LinkedIn, GitHub or Google can be copied. Upload the photo instead.",
			);
		throw sourceErrors.failed("The photo couldn't be copied just now. Try again, or upload it instead.");
	}

	let processed: Awaited<ReturnType<typeof processImageForUpload>>;
	try {
		processed = await processImageForUpload(
			new File([new Uint8Array(body.bytes)], "photo", { type: body.contentType }),
		);
	} catch (error) {
		if (error instanceof ORPCError) throw sourceErrors.invalid("That photo can't be used. Upload another one.");
		throw error;
	}
	const stored = await uploadFile({ userId, data: processed.data, contentType: processed.contentType });
	return { url: stored.url };
}
