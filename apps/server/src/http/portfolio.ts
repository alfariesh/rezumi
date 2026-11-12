import type { PortfolioEventKind } from "@rezumi/schema/portfolio/statistics";
import { notifyPortfolioMessages, submitPortfolioMessage } from "@rezumi/api/features/portfolio/contact";
import {
	findPortfolioEventTarget,
	findPublicPortfolio,
	recordPortfolioEvent,
} from "@rezumi/api/features/portfolio/public";
import { publicPortfolioRequestAllowed, tooManyPortfolioRequests } from "@rezumi/api/features/portfolio/public-limit";
import { notifyPortfolioReport, submitPortfolioReport } from "@rezumi/api/features/portfolio/report";
import { portfolioAccess, verifyPortfolioPassword } from "@rezumi/api/features/portfolio/visitor-access";
import { env } from "@rezumi/env/server";
import { buildPortfolioVcard } from "@rezumi/portfolio/vcard";
import { PORTFOLIO_SLUG_PATTERN } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_ITEM_ID_PATTERN, PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_EVENT_KINDS } from "@rezumi/schema/portfolio/statistics";
import { isSpeculative, publicPortfolioView, runAfterResponse } from "../static/portfolio-page";

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const notFound = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * A beacon's body: `{"kind": …, "id"?: …, "ref"?: …}`, sent as text so a browser needs no preflight; null when it isn't
 * one. A beacon on a work's page carries the work's `id` (a click's, or a prerendered work page's `view`); a `view`
 * beacon carries `ref`, the page's `document.referrer` (at most 300 characters kept). Anything else is ignored.
 */
export function parsePortfolioEvent(body: string): { kind: PortfolioEventKind; id?: string; ref?: string } | null {
	let value: unknown;
	try {
		value = JSON.parse(body);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) return null;
	const { kind, id, ref } = value as { kind?: unknown; id?: unknown; ref?: unknown };
	const known = PORTFOLIO_EVENT_KINDS.find((name) => name === kind);
	if (!known) return null;
	const event: { kind: PortfolioEventKind; id?: string; ref?: string } = { kind: known };
	if (typeof id === "string" && PORTFOLIO_ITEM_ID_PATTERN.test(id)) event.id = id;
	if (known === "view" && typeof ref === "string" && ref) event.ref = ref.slice(0, 300);
	return event;
}

/**
 * `POST /api/portfolio/<username>/event`: counted after answering, so a page's beacon never waits on the database. A
 * portfolio behind a password counts only beacons from visitors who opened it.
 */
export async function handlePortfolioEvent(
	request: Request,
	username: string,
	trustedClient: string,
): Promise<Response> {
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return noContent();
	const event = parsePortfolioEvent(await request.text());
	const target = await findPortfolioEventTarget(username, event?.id);
	if (!target) return notFound();
	if (!event || isSpeculative(request.headers)) return noContent();
	if ((await portfolioAccess(target, request.headers)) === "locked") return noContent();
	await runAfterResponse(
		recordPortfolioEvent({
			target,
			kind: event.kind,
			workId: event.id,
			ref: event.ref,
			requestHeaders: request.headers,
			trustedClient,
		}),
		"Portfolio event counting failed",
	);
	return noContent();
}

const STATUS = { invalid: 400, turnstile: 403, rate_limited: 429, unavailable: 503 } as const;

async function readForm(request: Request): Promise<Record<string, unknown> | null> {
	try {
		return Object.fromEntries(await request.formData());
	} catch {
		return null;
	}
}

/** A database error's text holds the query's values, a visitor's message among them, so it never reaches a log. */
async function submitSafely(request: Request, username: string, form: Record<string, unknown>, trustedClient: string) {
	try {
		return await submitPortfolioMessage({ username, form, trustedClient, requestHeaders: request.headers });
	} catch {
		console.error("[portfolio] A contact form message could not be saved.");
		return { ok: false, code: "unavailable" } as const;
	}
}

/**
 * `POST /api/portfolio/<username>/message`, from the page script (JSON answer) or a plain form post (back to the page
 * with `?contact=`). The owner's email goes out after the answer. A failure is reported by name only: the visitor's
 * message never reaches a log.
 */
export async function handlePortfolioMessage(
	request: Request,
	username: string,
	trustedClient: string,
): Promise<Response> {
	const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
	const headers = { "Cache-Control": "no-store" };
	// Past the flood limit, the answer has the form's own shape (JSON, or back to the page), not a bare 429 page.
	const allowed = await publicPortfolioRequestAllowed(trustedClient);
	const form = allowed ? await readForm(request) : null;
	const result = !allowed
		? ({ ok: false, code: "rate_limited" } as const)
		: form
			? await submitSafely(request, username, form, trustedClient)
			: ({ ok: false, code: "invalid" } as const);
	if (!result)
		return wantsJson ? Response.json({ ok: false, code: "unavailable" }, { status: 404, headers }) : notFound();

	if (result.ok && result.portfolioId) {
		const { portfolioId } = result;
		await runAfterResponse(notifyPortfolioMessages(portfolioId), "Portfolio message notification failed");
	}
	if (wantsJson)
		return result.ok
			? Response.json({ ok: true }, { headers })
			: Response.json({ ok: false, code: result.code }, { status: STATUS[result.code], headers });

	const outcome = result.ok ? "sent" : "failed";
	return new Response(null, {
		status: 303,
		headers: { ...headers, Location: `/${encodeURIComponent(username)}?contact=${outcome}#contact` },
	});
}

/** Like the contact form, a report's words never reach a log, and a database error's text would hold them. */
async function submitReportSafely(username: string, form: Record<string, unknown>, trustedClient: string) {
	try {
		return await submitPortfolioReport({ username, form, trustedClient });
	} catch {
		console.error("[portfolio] A report could not be saved.");
		return { ok: false, code: "unavailable" } as const;
	}
}

/**
 * `POST /api/portfolio/<username>/report`, from the report page's plain form: back to that page with the outcome. The
 * email to the operator goes out after the answer.
 */
export async function handlePortfolioReport(
	request: Request,
	username: string,
	trustedClient: string,
): Promise<Response> {
	const allowed = await publicPortfolioRequestAllowed(trustedClient);
	const form = allowed ? await readForm(request) : null;
	const result = !allowed
		? ({ ok: false, code: "rate_limited" } as const)
		: form
			? await submitReportSafely(username, form, trustedClient)
			: ({ ok: false, code: "invalid" } as const);
	if (!result) return notFound();
	if (result.ok && result.reportId) {
		const { reportId } = result;
		await runAfterResponse(notifyPortfolioReport(reportId), "Portfolio report notification failed");
	}
	return new Response(null, {
		status: 303,
		headers: {
			"Cache-Control": "no-store",
			Location: `/${encodeURIComponent(username)}?report=${result.ok ? "sent" : "failed"}`,
		},
	});
}

/** Where a password page's form returns: the home, its report form, or one work's page (a slug the pattern allows). */
export function unlockTarget(next: string, username: string, onAppHost: boolean): string {
	const home = onAppHost ? `/${encodeURIComponent(username)}` : "/";
	if (next === "report") return `${home}?report`;
	const slug = next.startsWith("work:") ? next.slice("work:".length) : "";
	if (slug && slug.length <= PORTFOLIO_LIMITS.text.slug && PORTFOLIO_SLUG_PATTERN.test(slug))
		return `${onAppHost ? home : ""}/work/${slug}`;
	return home;
}

/** Whether a request came to the app's own host (or its alias), not a custom domain. */
function isAppHost(request: Request): boolean {
	const host = new URL(request.url).hostname.toLowerCase();
	return [env.APP_URL, env.APP_ALIAS_URL].some(
		(address) => address && new URL(address).hostname.toLowerCase() === host,
	);
}

/**
 * `POST /api/portfolio/<username>/unlock` (Phase 13, B16): the password page's form. Right: back to the page asked for,
 * with the access cookie for this host. Wrong or too many tries: back with `unlock=wrong|limited`. The target is built
 * here from a known `next` (never an address from the form), so it can't send anyone elsewhere. No portfolio: 404.
 */
export async function handlePortfolioUnlock(
	request: Request,
	username: string,
	trustedClient: string,
): Promise<Response> {
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const form = await readForm(request);
	const password = typeof form?.password === "string" ? form.password : "";
	const next = typeof form?.next === "string" ? form.next : "home";
	const target = unlockTarget(next, username, isAppHost(request));
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (!(await findPublicPortfolio(username))) return notFound();
	let result: Awaited<ReturnType<typeof verifyPortfolioPassword>>;
	try {
		result = await verifyPortfolioPassword({ username, password, trustedClient, responseHeaders: headers });
	} catch {
		// The password never reaches a log.
		console.error("[portfolio] A password check could not be completed.");
		result = "wrong";
	}
	const separator = target.includes("?") ? "&" : "?";
	headers.set("Location", result === "ok" ? target : `${target}${separator}unlock=${result}`);
	return new Response(null, { status: 303, headers });
}

/**
 * `GET /api/portfolio/<username>/vcard` (Phase 13, B14): "Save contact", a vCard of what the page shows. Only for a
 * portfolio the visitor may open: a locked one, an unpublished one or the switch off answers 404.
 */
export async function handlePortfolioVcard(
	request: Request,
	username: string,
	trustedClient: string,
): Promise<Response> {
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const portfolio = await findPublicPortfolio(username);
	if (!portfolio || (await portfolioAccess(portfolio, request.headers)) === "locked") return notFound();
	const view = publicPortfolioView(portfolio);
	const url = portfolio.customDomain
		? `https://${portfolio.customDomain}/`
		: `${new URL(env.APP_URL).origin}/${encodeURIComponent(portfolio.username)}`;
	return new Response(buildPortfolioVcard(view, { url }), {
		headers: {
			"Content-Type": "text/vcard; charset=utf-8",
			"Content-Disposition": `attachment; filename="${portfolio.username.replace(/[^\w.-]/g, "")}.vcf"`,
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex",
		},
	});
}
