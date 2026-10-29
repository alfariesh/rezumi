import type { SendMailOptions, Transporter } from "nodemailer";
import type { ReactElement } from "react";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { render } from "react-email";
import { env } from "@rezumi/env/server";

type SendEmailOptions = { to: string; subject: string; react: ReactElement };

type EmailBinding = {
	send: (message: {
		to: string;
		from: string | { email: string; name?: string };
		subject: string;
		html?: string;
		text?: string;
	}) => Promise<unknown>;
};

let cachedTransport: Transporter | undefined;
let emailBinding: EmailBinding | undefined;

/** Cloudflare Workers pass their `send_email` binding here; it takes priority over SMTP. */
export const configureEmailBinding = (binding: EmailBinding | undefined) => {
	emailBinding = binding;
};

/** Accepts `Name <user@host>` or a bare address. */
const parseFrom = (from: string) => {
	const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
	return match?.[2]
		? { email: match[2].trim(), ...(match[1] ? { name: match[1].trim() } : {}) }
		: { email: from.trim() };
};

const errorSummary = (error: unknown) => {
	// Provider errors can contain credentials or authentication links; log only the type and code.
	const { name, code } = (error ?? {}) as { name?: string; code?: string };
	return { name: name ?? "Error", ...(code ? { code } : {}) };
};

const getTransport = () => {
	const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from } = env;
	if (!host || !user || !pass || !from) return;

	cachedTransport ??= nodemailer.createTransport({
		host,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		requireTLS: true,
		auth: { user, pass },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 10_000,
	});

	return cachedTransport;
};

export const sendEmail = async ({ to, subject, react }: SendEmailOptions) => {
	const transport = getTransport();
	if (emailBinding && env.SMTP_FROM) {
		try {
			await emailBinding.send({
				to,
				from: parseFrom(env.SMTP_FROM),
				subject,
				html: await render(react),
				text: await render(react, { plainText: true }),
			});
		} catch (error) {
			console.error("There was an error sending mail.", errorSummary(error));
		}
		return;
	}
	if (!transport && process.env.NODE_ENV === "production") {
		console.error("Email not configured (no send_email binding or SMTP); skipping email send.", { to, subject });
		return;
	}
	const payload: SendMailOptions = {
		to,
		from: env.SMTP_FROM,
		subject,
		html: await render(react),
		text: await render(react, { plainText: true }),
	};

	if (!transport) {
		console.info("SMTP not configured; skipping email send.", {
			to: payload.to,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
		});
		return;
	}

	try {
		await transport.sendMail(payload);
	} catch (error) {
		console.error("There was an error sending mail.", errorSummary(error));
	}
};

type SendCareerNotificationOptions = { to: string; subject: string; text: string; url: string; key: string };

/** Owner-only notifications: missing SMTP never logs personal career content. */
export async function sendCareerNotification({
	to,
	subject,
	text,
	url,
	key,
}: SendCareerNotificationOptions): Promise<boolean> {
	const transport = getTransport();
	const useBinding = Boolean(emailBinding && env.SMTP_FROM);
	if (!transport && !useBinding) return false;
	const link = new URL(url, env.APP_URL);
	if (link.origin !== new URL(env.APP_URL).origin)
		throw new Error("Career notification links must point to this application.");
	try {
		if (useBinding && emailBinding && env.SMTP_FROM) {
			await emailBinding.send({
				to,
				from: parseFrom(env.SMTP_FROM),
				subject,
				text: `${text}\n\n${link.toString()}`,
			});
			return true;
		}
		if (!transport) return false;
		await transport.sendMail({
			to,
			from: env.SMTP_FROM,
			subject,
			text: `${text}\n\n${link.toString()}`,
			messageId: `<career-${createHash("sha256").update(key).digest("hex")}@rezumi.local>`,
		});
		return true;
	} catch {
		// SMTP errors can contain recipient addresses, credentials or message fragments.
		throw new Error("Career notification email could not be delivered.");
	}
}
