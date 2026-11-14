import { ORPCError } from "@orpc/server";

/** The header the browser extension sends on every request: its own version, x.y.z. */
export const EXTENSION_VERSION_HEADER = "x-rezumi-extension";

const parts = (version: string) => {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
	return match ? match.slice(1).map(Number) : null;
};

/** Whether `version` is older than `minimum` (both x.y.z). An unreadable version counts as older. */
export function isOlderVersion(version: string, minimum: string): boolean {
	const have = parts(version);
	const need = parts(minimum);
	if (!need) return false;
	if (!have) return true;
	for (let index = 0; index < 3; index++) {
		const difference = (have[index] ?? 0) - (need[index] ?? 0);
		if (difference !== 0) return difference < 0;
	}
	return false;
}

/**
 * The emergency brake for a broken extension release (`EXTENSION_MIN_VERSION`): a request from an older extension is
 * refused with `EXTENSION_OUTDATED`, which the extension shows as "Update the extension". Requests without the header
 * (the web app, mobile, API keys, MCP) are never affected.
 */
export function assertExtensionVersion(headers: Headers, minimum: string | undefined) {
	const version = headers.get(EXTENSION_VERSION_HEADER);
	if (version === null || !minimum || !isOlderVersion(version, minimum)) return;
	throw new ORPCError("EXTENSION_OUTDATED", {
		status: 426,
		message: "This version of the Rezumi browser extension is too old. Update it to continue.",
		data: { minimumVersion: minimum },
	});
}
