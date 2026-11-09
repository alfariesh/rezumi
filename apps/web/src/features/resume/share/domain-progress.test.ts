import type { DomainStatus } from "./domain-progress";
import { describe, expect, it } from "vite-plus/test";
import { domainSteps, isDomainSettling, isRootDomain } from "./domain-progress";

const domain = (overrides: Partial<DomainStatus>): DomainStatus => ({
	hostname: "www.example.com",
	target: "domains.rezumi.app",
	txtName: "_rx-verify.www.example.com",
	txtValue: "rx-verify=token",
	records: [],
	verified: true,
	lastCheckedAt: null,
	managed: true,
	stage: "active",
	problem: null,
	plan: { state: "ok", until: null },
	...overrides,
});

const states = (value: DomainStatus, dns: Parameters<typeof domainSteps>[1] = null) =>
	domainSteps(value, dns).map((step) => step.state);

describe("domainSteps", () => {
	it("waits for DNS before anything else", () => {
		expect(states(domain({ verified: false, stage: "dns" }))).toEqual(["waiting", "waiting", "waiting", "waiting"]);
	});

	it("shows which DNS record a check found", () => {
		expect(states(domain({ verified: false, stage: "dns" }), { routing: true, ownership: false })).toEqual([
			"done",
			"waiting",
			"waiting",
			"waiting",
		]);
	});

	it.each(["hostname", "certificate"] as const)("works on the certificate while the stage is %s", (stage) => {
		expect(states(domain({ stage }))).toEqual(["done", "done", "working", "waiting"]);
	});

	it("marks the certificate failed on a problem and finishes when active", () => {
		expect(states(domain({ stage: "problem", problem: "caa" }))).toEqual(["done", "done", "failed", "waiting"]);
		expect(states(domain({ stage: "active" }))).toEqual(["done", "done", "done", "done"]);
	});
});

describe("isDomainSettling", () => {
	it("is only true while Cloudflare is working", () => {
		expect(isDomainSettling(domain({ stage: "hostname" }))).toBe(true);
		expect(isDomainSettling(domain({ stage: "certificate" }))).toBe(true);
		expect(isDomainSettling(domain({ stage: "active" }))).toBe(false);
		expect(isDomainSettling(domain({ stage: "dns" }))).toBe(false);
		expect(isDomainSettling(null)).toBe(false);
	});

	it("stops once the domain only redirects, whose hostname may be gone for good", () => {
		expect(isDomainSettling(domain({ stage: "hostname", plan: { state: "redirecting", until: null } }))).toBe(false);
	});
});

describe("isRootDomain", () => {
	it("reads two labels as a root domain", () => {
		expect(isRootDomain("example.com")).toBe(true);
		expect(isRootDomain("www.example.com")).toBe(false);
	});
});
