import type { QueryClient } from "@tanstack/react-query";
import { authClient } from "@/libs/auth/client";
import { sessionQueryKey } from "@/libs/root-context";

/** The zone this device is set to ("Asia/Jakarta"), or null when the browser doesn't say. */
export function deviceTimeZone(): string | null {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
	} catch {
		return null;
	}
}

/**
 * Saves the account's timezone (Settings → Timezone does the same) and reads the session again, so everything that
 * shows times follows. Resolves with whether it was saved.
 */
export async function saveAccountTimeZone(
	timezone: string,
	queryClient: QueryClient,
	invalidateRouter: () => Promise<unknown>,
): Promise<boolean> {
	const { error } = await authClient.updateUser({ timezone });
	if (error) return false;
	await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
	await invalidateRouter();
	return true;
}

/** An account this young can't have chosen a timezone yet: "UTC" there is only the column's default. */
const NEW_ACCOUNT_MS = 30 * 60_000;

/** Accounts this tab already adopted the device's zone for, so a failure isn't retried on every render. */
const adopted = new Set<string>();

type TimeZoneUser = { id: string; timezone?: string | null | undefined; createdAt: Date | string };

/**
 * Whether a just-created account should take this device's timezone: it still has the default ("UTC"), it's under
 * half an hour old (so nobody chose UTC on purpose), and the device is somewhere else.
 */
export function shouldAdoptDeviceTimeZone(user: TimeZoneUser, device: string | null, now = Date.now()): boolean {
	if (!device || device === "UTC" || device === "Etc/UTC") return false;
	if ((user.timezone ?? "UTC") !== "UTC") return false;
	const created = new Date(user.createdAt).getTime();
	return Number.isFinite(created) && now - created >= 0 && now - created < NEW_ACCOUNT_MS;
}

/**
 * A new account starts in UTC (the column's default); the first page it opens sets it to the device's zone, so
 * statistics days, interview times and reminders are local from the start. Sign-up by email and by Google or GitHub
 * both end here. Accounts that are older, or chose a zone, are left alone.
 */
export function adoptDeviceTimeZone(
	user: TimeZoneUser | undefined,
	queryClient: QueryClient,
	invalidateRouter: () => Promise<unknown>,
) {
	if (!user || adopted.has(user.id)) return;
	const device = deviceTimeZone();
	if (!device || !shouldAdoptDeviceTimeZone(user, device)) return;
	adopted.add(user.id);
	void saveAccountTimeZone(device, queryClient, invalidateRouter);
}
