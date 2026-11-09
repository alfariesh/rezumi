import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
	findTarget: vi.fn(),
	recordEvent: vi.fn(),
	submit: vi.fn(),
	notify: vi.fn(),
	submitReport: vi.fn(),
	notifyReport: vi.fn(),
}));

vi.mock("@rezumi/api/features/portfolio/public", () => ({
	findPortfolioEventTarget: mocks.findTarget,
	findPublicPortfolio: vi.fn(),
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
vi.mock("../static/resume-page", () => ({ serveResumePage: vi.fn() }));

const { handlePortfolioEvent, handlePortfolioMessage, handlePortfolioReport, parsePortfolioEvent } =
	await import("./portfolio");

const target = { id: "pf1", userId: "owner", timezone: "UTC", hasWork: true };
const event = (body: string, headers: Record<string, string> = {}) =>
	new Request("https://rezumi.example/api/portfolio/nadia/event", { method: "POST", body, headers });

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.findTarget.mockResolvedValue(target);
	mocks.recordEvent.mockResolvedValue(undefined);
	mocks.notify.mockResolvedValue(true);
});

describe("parsePortfolioEvent", () => {
	it("accepts the known kinds, and a work only with a valid id", () => {
		expect(parsePortfolioEvent('{"kind":"whatsapp"}')).toEqual({ kind: "whatsapp" });
		expect(parsePortfolioEvent('{"kind":"work","id":"w1"}')).toEqual({ kind: "work", id: "w1" });
		expect(parsePortfolioEvent('{"kind":"work"}')).toBeNull();
		expect(parsePortfolioEvent('{"kind":"work","id":"../x"}')).toBeNull();
	});

	it("refuses anything else", () => {
		for (const body of ["", "nope", "null", "[]", '{"kind":"view"}', '{"kind":"constructor"}'])
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
