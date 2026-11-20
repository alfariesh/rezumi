import { env } from "@rezumi/env/server";
import { TREG_BASE_URL } from "./treg";

/**
 * treg's own figures for the admin cost dashboard (`02-teknis.md` section 21): the team's prepaid balance and what its
 * ledger charged per `feature` tag (`X-Treg-Meta`). These reads are free. The ledger is the money that left the
 * balance, so it is the figure to trust over Rezumi's own event counts. Never logs the token or the answer.
 */

const READ_TIMEOUT_MS = 10_000;

export type TregUsageRow = { feature: string; chargedMicro: number; calls: number };

export type TregAccount = {
	balanceMicro: number;
	/** What treg charged per feature over the period, most first. */
	usage: TregUsageRow[];
	totalMicro: number;
	/** Charges without a feature tag, such as calls made by hand from the treg CLI. */
	unattributedMicro: number;
};

export type TregAccountDependencies = { fetch?: typeof fetch; token?: string | undefined };

const base = () => env.TREG_BASE_URL ?? TREG_BASE_URL;
const micro = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? Math.round(number) : 0;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The team the token bills, found once per process: the token carries one team. */
let teamId: { token: string; id: number } | undefined;

async function readJson(path: string, token: string, request: typeof fetch): Promise<unknown> {
	const response = await request(new URL(path, base()), {
		headers: { "X-Treg-Token": token, Accept: "application/json" },
		signal: AbortSignal.timeout(READ_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`treg answered ${response.status}`);
	return response.json();
}

async function findTeam(token: string, request: typeof fetch): Promise<number> {
	if (teamId?.token === token) return teamId.id;
	const teams = await readJson("/orgs", token, request);
	const team = Array.isArray(teams)
		? teams.find(
				(entry) => isRecord(entry) && entry.active !== false && entry.demo !== true && Number(entry.org_id) > 0,
			)
		: undefined;
	if (!isRecord(team)) throw new Error("treg lists no active team for this token");
	teamId = { token, id: Number(team.org_id) };
	return teamId.id;
}

/** The balance and the last `days` days of charges; `not-configured` without a token, `unavailable` when treg fails. */
export async function readTregAccount(
	days: number,
	dependencies: TregAccountDependencies = {},
): Promise<TregAccount | "not-configured" | "unavailable"> {
	const token = "token" in dependencies ? dependencies.token : env.TREG_API_KEY;
	if (!token) return "not-configured";
	const request = dependencies.fetch ?? fetch;
	try {
		const team = await findTeam(token, request);
		const [balance, usage] = await Promise.all([
			readJson(`/orgs/${team}/balance`, token, request),
			readJson(`/orgs/${team}/usage/by-tag?key=feature&days=${Math.max(1, Math.round(days))}`, token, request),
		]);
		if (!isRecord(balance) || !isRecord(usage)) throw new Error("treg answered in an unexpected shape");
		const rows = Array.isArray(usage.rows) ? usage.rows.filter(isRecord) : [];
		return {
			balanceMicro: micro(balance.balance_micro),
			usage: rows
				.map((row) => ({
					feature: String(row.value ?? ""),
					chargedMicro: micro(row.charged_micro),
					calls: micro(row.calls),
				}))
				.filter((row) => row.feature)
				.sort((a, b) => b.chargedMicro - a.chargedMicro),
			totalMicro: micro(usage.total_micro),
			unattributedMicro: micro(usage.unattributed_micro),
		};
	} catch {
		teamId = undefined;
		console.error("[jobs] Reading the treg balance failed.");
		return "unavailable";
	}
}
