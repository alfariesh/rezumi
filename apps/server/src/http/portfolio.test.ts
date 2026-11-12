import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
	findTarget: vi.fn(),
	recordEvent: vi.fn(),
	submit: vi.fn(),
	notify: vi.fn(),
	submitReport: vi.fn(),
	notifyReport: vi.fn(),
	allowed: vi.fn(),
	findPortfolio: vi.fn(),
	access: vi.fn(),
	verify: vi.fn(),
}));

vi.mock("@rezumi/api/features/portfolio/public-limit", () => ({
	publicPortfolioRequestAllowed: mocks.allowed,
	tooManyPortfolioRequests: () => new Response("Too Many Requests", { status: 429 }),
}));

vi.mock("@rezumi/api/features/portfolio/public", () => ({
	findPortfolioEventTarget: mocks.findTarget,
	findPublicPortfolio: mocks.findPortfolio,
	recordPortfolioEvent: mocks.recordEvent,
	recordPortfolioVisit: vi.fn(),
}));
vi.mock("@rezumi/api/features/portfolio/contact", () => ({
	notifyPortfolioMessages: mocks.notify,
	submitPortfolioMessage: mocks.submit,
}));
vi.mock("@rezumi/api/features/portfolio/report", () => ({
	notifyPortfolioReport: mocks.notifyReport,
	submitPortfolioReport: mocks.submitReport,
}));
vi.mock("../static/resume-page", () => ({ serveResumePage: vi.fn(), unavailableResponse: vi.fn() }));
vi.mock("@rezumi/api/features/portfolio/visitor-access", () => ({
	portfolioAccess: mocks.access,
	verifyPortfolioPassword: mocks.verify,
}));
vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return { env: { ...env, APP_URL: "https://rezumi.example", APP_ALIAS_URL: undefined } };
});

const {
	handlePortfolioEvent,
	handlePortfolioMessage,
	handlePortfolioReport,
	handlePortfolioUnlock,
	handlePortfolioVcard,
	parsePortfolioEvent,
	unlockTarget,
} = await import("./portfolio");

const target = { id: "pf1", userId: "owner", timezone: "UTC", hasWork: true, passwordHash: null };
const event = (body: string, headers: Record<string, string> = {}) =>
	new Request("https://rezumi.example/api/portfolio/nadia/event", { method: "POST", body, headers });

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.findTarget.mockResolvedValue(target);
	mocks.recordEvent.mockResolvedValue(undefined);
	mocks.notify.mockResolvedValue(true);
	mocks.allowed.mockResolvedValue(true);
	mocks.access.mockResolvedValue("open");
});

describe("parsePortfolioEvent", () => {
	it("accepts the known kinds, a click's work id when it's valid, and a view's referrer", () => {
		expect(parsePortfolioEvent('{"kind":"whatsapp"}')).toEqual({ kind: "whatsapp" });
		expect(parsePortfolioEvent('{"kind":"pdf","id":"w1"}')).toEqual({ kind: "pdf", id: "w1" });
		expect(parsePortfolioEvent('{"kind":"pdf","id":"../x"}')).toEqual({ kind: "pdf" });
		expect(parsePortfolioEvent('{"kind":"embed"}')).toEqual({ kind: "embed" });
		expect(parsePortfolioEvent('{"kind":"vcard"}')).toEqual({ kind: "vcard" });
		expect(parsePortfolioEvent('{"kind":"view"}')).toEqual({ kind: "view" });
		expect(parsePortfolioEvent(`{"kind":"view","ref":"${"x".repeat(400)}"}`)?.ref).toHaveLength(300);
		// A prerendered work page's view names its work, and where the visitor came from.
		expect(parsePortfolioEvent('{"kind":"view","id":"w1","ref":"https://www.google.com/"}')).toEqual({
			kind: "view",
			id: "w1",
			ref: "https://www.google.com/",
		});
		expect(parsePortfolioEvent('{"kind":"pdf","ref":"https://x.example"}')).toEqual({ kind: "pdf" });
		// Opening a work is counted by its page now, not by a beacon.
		expect(parsePortfolioEvent('{"kind":"work","id":"w1"}')).toBeNull();
	});

	it("refuses anything else", () => {
		for (const body of ["", "nope", "null", "[]", '{"kind":"visit"}', '{"kind":"constructor"}'])
			expect(parsePortfolioEvent(body), body).toBeNull();
	});
});

describe("POST /api/portfolio/<username>/event", () => {
	it("counts a click and answers with no content", async () => {
		const response = await handlePortfolioEvent(event('{"kind":"email"}'), "nadia", "1.1.1.1");
		expect(response.status).toBe(204);
		expect(mocks.recordEvent).toHaveBeenCalledWith(
			expect.objectContaining({ target, kind: "email", trustedClient: "1.1.1.1" }),
		);
	});

	it("is a 404 when the address shows no portfolio, as while the switch is off", async () => {
		mocks.findTarget.mockResolvedValue(null);
		const response = await handlePortfolioEvent(event('{"kind":"email"}'), "ghost", "1.1.1.1");
		expect(response.status).toBe(404);
		expect(mocks.recordEvent).not.toHaveBeenCalled();
	});

	it("answers 204 without counting a bad body or a speculative request", async () => {
		expect((await handlePortfolioEvent(event("nope"), "nadia", "1.1.1.1")).status).toBe(204);
		const prefetch = event('{"kind":"email"}', { "sec-purpose": "prefetch" });
		expect((await handlePortfolioEvent(prefetch, "nadia", "1.1.1.1")).status).toBe(204);
		expect(mocks.recordEvent).not.toHaveBeenCalled();
	});

	it("counts nothing for a visitor who can't open a portfolio behind a password", async () => {
		mocks.access.mockResolvedValue("locked");
		expect((await handlePortfolioEvent(event('{"kind":"email"}'), "nadia", "1.1.1.1")).status).toBe(204);
		expect(mocks.recordEvent).not.toHaveBeenCalled();
	});

	it("still answers when counting fails", async () => {
		mocks.recordEvent.mockRejectedValue(new Error("db down"));
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect((await handlePortfolioEvent(event('{"kind":"email"}'), "nadia", "1.1.1.1")).status).toBe(204);
		await vi.waitFor(() => expect(log).toHaveBeenCalled());
		log.mockRestore();
	});
});

const message = (headers: Record<string, string> = {}) => {
	const body = new FormData();
	body.set("name", "Budi");
	body.set("message", "Private words");
	return new Request("https://rezumi.example/api/portfolio/nadia/message", { method: "POST", body, headers });
};
const asJson = { accept: "application/json" };

describe("POST /api/portfolio/<username>/message", () => {
	it("answers unavailable when saving fails, logging nothing of the message", async () => {
		mocks.submit.mockRejectedValueOnce(new Error("Failed query params: a very private note"));
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const form = new FormData();
		form.set("message", "a very private note");
		const response = await handlePortfolioMessage(
			new Request("https://rezumi.example/api/portfolio/nadia/message", {
				method: "POST",
				body: form,
				headers: { accept: "application/json" },
			}),
			"nadia",
			"203.0.113.9",
		);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ ok: false, code: "unavailable" });
		expect(JSON.stringify(log.mock.calls)).not.toContain("private note");
		log.mockRestore();
	});

	it("answers the page script with JSON and tells the owner after", async () => {
		mocks.submit.mockResolvedValue({ ok: true, portfolioId: "pf1" });
		const response = await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(mocks.notify).toHaveBeenCalledWith("pf1");
	});

	it("reads the form fields", async () => {
		mocks.submit.mockResolvedValue({ ok: true });
		await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1");
		expect(mocks.submit).toHaveBeenCalledWith(
			expect.objectContaining({
				username: "nadia",
				trustedClient: "1.1.1.1",
				form: expect.objectContaining({ name: "Budi", message: "Private words" }),
			}),
		);
	});

	it.each([
		["invalid", 400],
		["turnstile", 403],
		["rate_limited", 429],
		["unavailable", 503],
	] as const)("reports %s as %i", async (code, status) => {
		mocks.submit.mockResolvedValue({ ok: false, code });
		const response = await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1");
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ ok: false, code });
		expect(mocks.notify).not.toHaveBeenCalled();
	});

	it("answers past the flood limit in the form's own shape, without reading it", async () => {
		mocks.allowed.mockResolvedValue(false);
		const json = await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1");
		expect(json.status).toBe(429);
		expect(await json.json()).toEqual({ ok: false, code: "rate_limited" });
		const plain = await handlePortfolioMessage(message(), "nadia", "1.1.1.1");
		expect(plain.status).toBe(303);
		expect(plain.headers.get("Location")).toBe("/nadia?contact=failed#contact");
		const report = await handlePortfolioReport(message(), "nadia", "1.1.1.1");
		expect(report.headers.get("Location")).toBe("/nadia?report=failed");
		expect(mocks.submit).not.toHaveBeenCalled();
		expect(mocks.submitReport).not.toHaveBeenCalled();
	});

	it("answers a trapped bot like a success, without an email", async () => {
		mocks.submit.mockResolvedValue({ ok: true });
		expect((await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1")).status).toBe(200);
		expect(mocks.notify).not.toHaveBeenCalled();
	});

	it("sends a plain form post back to the page, sent or not", async () => {
		mocks.submit.mockResolvedValue({ ok: true, portfolioId: "pf1" });
		const sent = await handlePortfolioMessage(message(), "nadia", "1.1.1.1");
		expect(sent.status).toBe(303);
		expect(sent.headers.get("Location")).toBe("/nadia?contact=sent#contact");
		mocks.submit.mockResolvedValue({ ok: false, code: "turnstile" });
		const failed = await handlePortfolioMessage(message(), "nadia", "1.1.1.1");
		expect(failed.headers.get("Location")).toBe("/nadia?contact=failed#contact");
	});

	it("is a 404 when the address shows no portfolio", async () => {
		mocks.submit.mockResolvedValue(null);
		expect((await handlePortfolioMessage(message(), "ghost", "1.1.1.1")).status).toBe(404);
		expect((await handlePortfolioMessage(message(asJson), "ghost", "1.1.1.1")).status).toBe(404);
	});

	it("refuses a body that isn't a form", async () => {
		const request = new Request("https://rezumi.example/api/portfolio/nadia/message", {
			method: "POST",
			body: "not a form",
			headers: { "content-type": "text/plain", ...asJson },
		});
		const response = await handlePortfolioMessage(request, "nadia", "1.1.1.1");
		expect(response.status).toBe(400);
		expect(mocks.submit).not.toHaveBeenCalled();
	});

	it("never logs what the visitor wrote", async () => {
		mocks.submit.mockResolvedValue({ ok: true, portfolioId: "pf1" });
		mocks.notify.mockRejectedValue(new Error("smtp down"));
		const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "info"), vi.spyOn(console, "log")];
		for (const log of logs) log.mockImplementation(() => undefined);
		await handlePortfolioMessage(message(asJson), "nadia", "1.1.1.1");
		await vi.waitFor(() => expect(logs[0]).toHaveBeenCalled());
		expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain("Private words");
		for (const log of logs) log.mockRestore();
	});
});

describe("handlePortfolioReport", () => {
	const report = () =>
		new Request("https://rezumi.example/api/portfolio/nadia/report", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "reason=fraud&details=x",
		});

	it("goes back to the report page when sent, and emails the operator", async () => {
		mocks.submitReport.mockResolvedValue({ ok: true, reportId: "r1" });
		mocks.notifyReport.mockResolvedValue(true);
		const response = await handlePortfolioReport(report(), "nadia", "203.0.113.1");
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/nadia?report=sent");
		expect(mocks.notifyReport).toHaveBeenCalledWith("r1");
	});

	it("goes back with the failure when refused, without emailing", async () => {
		mocks.submitReport.mockResolvedValue({ ok: false, code: "turnstile" });
		const response = await handlePortfolioReport(report(), "nadia", "203.0.113.1");
		expect(response.headers.get("location")).toBe("/nadia?report=failed");
		expect(mocks.notifyReport).not.toHaveBeenCalled();
	});

	it("is not found for an address with no portfolio", async () => {
		mocks.submitReport.mockResolvedValue(null);
		expect((await handlePortfolioReport(report(), "nadia", "203.0.113.1")).status).toBe(404);
	});

	it("reports a save failure as a failure, logging no words", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mocks.submitReport.mockRejectedValue(new Error("details=secret"));
		const response = await handlePortfolioReport(report(), "nadia", "203.0.113.1");
		expect(response.headers.get("location")).toBe("/nadia?report=failed");
		expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
		logged.mockRestore();
	});
});

describe("POST /api/portfolio/<username>/unlock (Phase 13, B16)", () => {
	const unlock = (fields: Record<string, string>, host = "rezumi.example") => {
		const body = new FormData();
		for (const [name, value] of Object.entries(fields)) body.set(name, value);
		return new Request(`https://${host}/api/portfolio/nadia/unlock`, { method: "POST", body });
	};

	it("returns only to a page the server builds, never an address from the form", () => {
		expect(unlockTarget("home", "nadia", true)).toBe("/nadia");
		expect(unlockTarget("report", "nadia", true)).toBe("/nadia?report");
		expect(unlockTarget("work:kopi", "nadia", true)).toBe("/nadia/work/kopi");
		expect(unlockTarget("work:kopi", "nadia", false)).toBe("/work/kopi");
		expect(unlockTarget("home", "nadia", false)).toBe("/");
		for (const next of ["https://evil.example", "//evil.example", "work:../x", "work:Kopi", "work:", "anything"])
			expect(unlockTarget(next, "nadia", true), next).toBe("/nadia");
	});

	it("sets the access cookie on success, and says why on failure, without caching", async () => {
		mocks.findPortfolio.mockResolvedValue({ id: "pf1" });
		mocks.verify.mockImplementation(async (input: { responseHeaders: Headers }) => {
			input.responseHeaders.append("Set-Cookie", "portfolio_access_pf1=1.abc; Path=/");
			return "ok";
		});
		const ok = await handlePortfolioUnlock(unlock({ password: "rahasia-123", next: "work:kopi" }), "nadia", "1.1.1.1");
		expect(ok.status).toBe(303);
		expect(ok.headers.get("Location")).toBe("/nadia/work/kopi");
		expect(ok.headers.get("Set-Cookie")).toContain("portfolio_access_pf1=");
		expect(ok.headers.get("Cache-Control")).toBe("no-store");

		mocks.verify.mockResolvedValue("wrong");
		const wrong = await handlePortfolioUnlock(unlock({ password: "x", next: "report" }), "nadia", "1.1.1.1");
		expect(wrong.headers.get("Location")).toBe("/nadia?report&unlock=wrong");
		expect(wrong.headers.get("Set-Cookie")).toBeNull();
		mocks.verify.mockResolvedValue("limited");
		// On a custom domain, back to its own root.
		const limited = await handlePortfolioUnlock(unlock({ password: "x" }, "nadia.example"), "nadia", "1.1.1.1");
		expect(limited.headers.get("Location")).toBe("/?unlock=limited");
	});

	it("is a 404 for an address with no portfolio, checking no password", async () => {
		mocks.findPortfolio.mockResolvedValue(null);
		expect((await handlePortfolioUnlock(unlock({ password: "x" }), "ghost", "1.1.1.1")).status).toBe(404);
		expect(mocks.verify).not.toHaveBeenCalled();
	});
});

describe("GET /api/portfolio/<username>/vcard (Phase 13, B14)", () => {
	const shown = async () => {
		const { parsePortfolioData } = await import("@rezumi/schema/portfolio/data");
		return {
			id: "pf1",
			userId: "owner",
			username: "nadia",
			ownerName: "Nadia Rahmawati",
			timezone: "UTC",
			data: parsePortfolioData({ basics: { name: "Nadia Rahmawati", headline: "Product Designer" } }),
			updatedAt: new Date(),
			indexable: true,
			customDomain: null,
			resume: null,
			entitlements: { hidePortfolioCredit: false },
			passwordHash: null,
		};
	};
	const vcard = () => new Request("https://rezumi.example/api/portfolio/nadia/vcard");

	it("downloads a contact card of what the page shows, kept out of caches and search engines", async () => {
		mocks.findPortfolio.mockResolvedValue(await shown());
		const response = await handlePortfolioVcard(vcard(), "nadia", "1.1.1.1");
		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"content-type": "text/vcard; charset=utf-8",
			"content-disposition": 'attachment; filename="nadia.vcf"',
			"cache-control": "private, no-store",
			"x-robots-tag": "noindex",
		});
		const body = await response.text();
		expect(body).toContain("FN:Nadia Rahmawati");
		expect(body).toContain("URL:https://rezumi.example/nadia");
	});

	it("is a 404 for a portfolio that isn't shown or that the visitor can't open", async () => {
		mocks.findPortfolio.mockResolvedValue(null);
		expect((await handlePortfolioVcard(vcard(), "ghost", "1.1.1.1")).status).toBe(404);
		mocks.findPortfolio.mockResolvedValue({ ...(await shown()), passwordHash: "$2a$10$x" });
		mocks.access.mockResolvedValue("locked");
		const locked = await handlePortfolioVcard(vcard(), "nadia", "1.1.1.1");
		expect(locked.status).toBe(404);
		expect(await locked.text()).not.toContain("Nadia");
	});
});

describe("a contact message to a portfolio behind a password", () => {
	it("passes the visitor's request on, so the gate can close the form to them", async () => {
		mocks.submit.mockResolvedValue({ ok: false, code: "unavailable" });
		const request = message(asJson);
		const response = await handlePortfolioMessage(request, "nadia", "1.1.1.1");
		expect(response.status).toBe(503);
		expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ requestHeaders: request.headers }));
	});
});
