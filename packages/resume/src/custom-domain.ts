// A custom domain's connection, as Share shows it on the web and in the app: the steps a domain goes through with the
// Cloudflare automation and whether the status is still moving by itself. Shapes follow `customDomain.get`.

export type DomainStage = "dns" | "hostname" | "certificate" | "active" | "problem";
export type DomainPlanState = "ok" | "grace" | "redirecting";
export type DomainProblem = "dns_moved" | "caa" | "certificate" | "blocked" | "rejected" | "quota";

/** The fields of `customDomain.get` these helpers read. */
export type DomainProgressInput = {
	verified: boolean;
	stage: DomainStage;
	plan: { state: DomainPlanState };
};

/** What the last `customDomain.verify` found in DNS; only known right after a check. */
export type DnsFindings = { routing: boolean; ownership: boolean };

export type DomainStepKey = "routing" | "ownership" | "certificate" | "active";
export type DomainStepState = "done" | "working" | "waiting" | "failed";
export type DomainStep = { key: DomainStepKey; state: DomainStepState };

/**
 * The steps a domain goes through with the Cloudflare automation (custom domain plan `01-desain.md` section 11). DNS
 * findings exist only right after a check; a proven domain has passed both DNS steps either way.
 */
export function domainSteps(domain: DomainProgressInput, dns: DnsFindings | null): DomainStep[] {
	const passed = (found: boolean | undefined): DomainStepState => (domain.verified || found ? "done" : "waiting");
	const stage = domain.stage;
	const certificate: DomainStepState =
		stage === "active" ? "done" : stage === "problem" ? "failed" : stage === "dns" ? "waiting" : "working";
	return [
		{ key: "routing", state: passed(dns?.routing) },
		{ key: "ownership", state: passed(dns?.ownership) },
		{ key: "certificate", state: certificate },
		{ key: "active", state: stage === "active" ? "done" : "waiting" },
	];
}

/** Whether Cloudflare is still working on the domain, so the status is worth reading again by itself. */
export const isDomainSettling = (domain: DomainProgressInput | null | undefined) =>
	domain?.plan.state !== "redirecting" && (domain?.stage === "hostname" || domain?.stage === "certificate");

/** `example.com`: two labels. A name under a two-part suffix (`example.co.uk`) gets no hint; the server draws the same line. */
export const isRootDomain = (hostname: string) => hostname.split(".").length === 2;

/** How often Share reads a settling domain's status again. */
export const DOMAIN_SETTLING_REFRESH_MS = 15_000;
