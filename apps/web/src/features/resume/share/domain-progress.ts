import type { RouterOutput } from "@/libs/orpc/client";

export type DomainStatus = NonNullable<RouterOutput["customDomain"]["get"]>;
export type DnsFindings = RouterOutput["customDomain"]["verify"]["dns"];

type DomainStepKey = "routing" | "ownership" | "certificate" | "active";
type DomainStepState = "done" | "working" | "waiting" | "failed";
export type DomainStep = { key: DomainStepKey; state: DomainStepState };

/**
 * The steps a domain goes through with the Cloudflare automation (`01-desain.md` section 11). DNS findings exist only
 * right after a check; a proven domain has passed both DNS steps either way.
 */
export function domainSteps(domain: DomainStatus, dns: DnsFindings | null): DomainStep[] {
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
export const isDomainSettling = (domain: DomainStatus | null | undefined) =>
	domain?.plan.state !== "redirecting" && (domain?.stage === "hostname" || domain?.stage === "certificate");

/** `example.com`: two labels. A name under a two-part suffix (`example.co.uk`) gets no hint; the server draws the same line. */
export const isRootDomain = (hostname: string) => hostname.split(".").length === 2;
