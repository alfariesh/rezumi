const DAY_MS = 24 * 60 * 60 * 1000;

/** After the plan ends the domain keeps working this long (`00-keputusan.md` rule #2). */
export const PLAN_GRACE_DAYS = 7;
export const PLAN_GRACE_MS = PLAN_GRACE_DAYS * DAY_MS;
/**
 * After the grace the domain redirects to `/<username>`, which needs the hostname and its certificate at Cloudflare.
 * It's deleted this long after that, so a domain nobody renews stops costing (owner decision 2026-11-09).
 */
export const HOSTNAME_KEEP_MS = 30 * DAY_MS;

export type DomainPlanState = "ok" | "grace" | "redirecting";

export function planStateOf(planLapsedAt: Date | null, now: Date): { state: DomainPlanState; until: Date | null } {
	if (!planLapsedAt) return { state: "ok", until: null };
	const until = new Date(planLapsedAt.getTime() + PLAN_GRACE_MS);
	return until > now ? { state: "grace", until } : { state: "redirecting", until: null };
}

export const isHostnameDeletionDue = (planLapsedAt: Date | null, now: Date) =>
	planLapsedAt !== null && planLapsedAt.getTime() + PLAN_GRACE_MS + HOSTNAME_KEEP_MS <= now.getTime();

export type ConnectionStage = "dns" | "hostname" | "certificate" | "active" | "problem";

/** A stored problem: what Cloudflare reports about the hostname, or why it couldn't be made. */
export type ConnectionProblem = "dns_moved" | "blocked" | "caa" | "certificate" | "quota" | "rejected";

const PROBLEMS: ReadonlySet<string> = new Set<ConnectionProblem>([
	"dns_moved",
	"blocked",
	"caa",
	"certificate",
	"quota",
	"rejected",
]);

export const toConnectionProblem = (value: string | null): ConnectionProblem | null =>
	value && PROBLEMS.has(value) ? (value as ConnectionProblem) : null;

type ConnectionFields = {
	verifiedAt: Date | null;
	cfHostnameId: string | null;
	cfHostnameStatus: string | null;
	cfSslStatus: string | null;
	cfProblem: string | null;
};

/** How far a domain has come. Without the automation, DNS proof is all the app knows, so a proven domain is active. */
export function connectionStageOf(domain: ConnectionFields, managed: boolean): ConnectionStage {
	if (!domain.verifiedAt) return "dns";
	if (!managed) return "active";
	if (toConnectionProblem(domain.cfProblem)) return "problem";
	if (!domain.cfHostnameId || domain.cfHostnameStatus !== "active") return "hostname";
	return domain.cfSslStatus === "active" ? "active" : "certificate";
}
