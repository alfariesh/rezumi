import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const envMock = vi.hoisted(() => ({
	SMTP_HOST: undefined as string | undefined,
	SMTP_PORT: 587,
	SMTP_USER: undefined as string | undefined,
	SMTP_PASS: undefined as string | undefined,
	SMTP_FROM: undefined as string | undefined,
	SMTP_SECURE: false,
}));

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail })));

vi.mock("@rezumi/env/server", () => ({ env: envMock }));
vi.mock("nodemailer", () => ({
	default: { createTransport },
	createTransport,
}));
vi.mock("react-email", () => ({
	render: async (_node: unknown, opts?: { plainText?: boolean }) =>
		opts?.plainText ? "plain text body" : "<p>html body</p>",
}));

const { sendEmail, deliverEmail, configureEmailBinding } = await import("./transport");

const fakeReact = { $$typeof: Symbol.for("react.element") } as unknown as React.ReactElement;

const resetEnv = () => {
	envMock.SMTP_HOST = undefined;
	envMock.SMTP_USER = undefined;
	envMock.SMTP_PASS = undefined;
	envMock.SMTP_FROM = undefined;
	createTransport.mockClear();
	sendMail.mockClear();
};
describe("sendEmail", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
	});

	it("skips email send and logs without body in production when SMTP is not configured", async () => {
		resetEnv();
		process.env.NODE_ENV = "production";
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			sendEmail({ to: "user@example.com", subject: "Reset password", react: fakeReact }),
		).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalledWith(
			"Email not configured (no send_email binding or SMTP); skipping email send.",
			{
				to: "user@example.com",
				subject: "Reset password",
			},
		);
		errorSpy.mockRestore();
	});

	it("skips email send and logs with body in development when SMTP is not configured", async () => {
		resetEnv();
		process.env.NODE_ENV = "development";
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await expect(
			sendEmail({ to: "user@example.com", subject: "Reset password", react: fakeReact }),
		).resolves.toBeUndefined();
		expect(infoSpy).toHaveBeenCalledWith("SMTP not configured; skipping email send.", {
			to: "user@example.com",
			subject: "Reset password",
			text: "plain text body",
			html: "<p>html body</p>",
		});
		infoSpy.mockRestore();
	});

	it("does not throw or log sensitive details if the SMTP transport errors", async () => {
		resetEnv();
		process.env.NODE_ENV = "production";
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		sendMail.mockRejectedValueOnce(new Error("SMTP rejected password=secret reset-token=private"));

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact })).resolves.toBeUndefined();
		expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
		expect(errorSpy).toHaveBeenCalledExactlyOnceWith("There was an error sending mail.", { name: "Error" });
		errorSpy.mockRestore();
	});

	it("sends through the Cloudflare binding when configured, ahead of SMTP", async () => {
		resetEnv();
		process.env.NODE_ENV = "production";
		envMock.SMTP_FROM = "Rezumi <noreply@rezumi.app>";
		const send = vi.fn().mockResolvedValue({});
		configureEmailBinding({ send });
		await sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact });
		configureEmailBinding(undefined);
		expect(send).toHaveBeenCalledExactlyOnceWith({
			to: "a@b.com",
			from: { email: "noreply@rezumi.app", name: "Rezumi" },
			subject: "hi",
			html: "<p>html body</p>",
			text: "plain text body",
		});
		expect(createTransport).not.toHaveBeenCalled();
	});
});

describe("deliverEmail", () => {
	it("sends a reply address through SMTP and the Cloudflare binding", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "Rezumi <noreply@example.com>";
		await deliverEmail({ to: "a@b.com", subject: "New", react: fakeReact, replyTo: "visitor@example.com" });
		expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "visitor@example.com" }));

		const send = vi.fn().mockResolvedValue({});
		configureEmailBinding({ send });
		try {
			await deliverEmail({ to: "a@b.com", subject: "New", react: fakeReact, replyTo: "visitor@example.com" });
			expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "visitor@example.com" }));
		} finally {
			configureEmailBinding(undefined);
		}
	});

	it("keeps a private body out of the development log", async () => {
		resetEnv();
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
		await expect(
			deliverEmail({ to: "a@b.com", subject: "New message", react: fakeReact, privateBody: true }),
		).resolves.toBe("logged");
		const logged = JSON.stringify(info.mock.calls);
		expect(logged).toContain("New message");
		expect(logged).not.toContain("plain text body");
		expect(logged).not.toContain("a@b.com");
		info.mockRestore();
	});

	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		vi.restoreAllMocks();
	});

	it("reports an unconfigured production server instead of pretending it sent", async () => {
		resetEnv();
		process.env.NODE_ENV = "production";
		await expect(deliverEmail({ to: "a@b.com", subject: "Receipt", react: fakeReact })).resolves.toBe("unconfigured");
	});

	it("logs the text without the recipient in development", async () => {
		resetEnv();
		process.env.NODE_ENV = "development";
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await expect(deliverEmail({ to: "a@b.com", subject: "Receipt", react: fakeReact })).resolves.toBe("logged");
		expect(infoSpy).toHaveBeenCalledExactlyOnceWith("SMTP not configured; skipping email send.", {
			subject: "Receipt",
			text: "plain text body",
		});
	});

	it("throws a summary without the provider's message when sending fails", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		sendMail.mockRejectedValueOnce(Object.assign(new Error("password=secret"), { code: "EAUTH" }));
		const failure = deliverEmail({ to: "a@b.com", subject: "Receipt", react: fakeReact });
		await expect(failure).rejects.toThrow("The email could not be delivered (EAUTH).");
		await expect(failure).rejects.not.toThrow(/secret/);
	});

	it("sends and says so", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		await expect(deliverEmail({ to: "a@b.com", subject: "Receipt", react: fakeReact })).resolves.toBe("sent");
		expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ to: "a@b.com", subject: "Receipt" }));
	});
});
