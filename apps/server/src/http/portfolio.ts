import type { PortfolioEventKind } from "@rezumi/schema/portfolio/statistics";
import { notifyPortfolioMessages, submitPortfolioMessage } from "@rezumi/api/features/portfolio/contact";
import { findPortfolioEventTarget, recordPortfolioEvent } from "@rezumi/api/features/portfolio/public";
import { publicPortfolioRequestAllowed, tooManyPortfolioRequests } from "@rezumi/api/features/portfolio/public-limit";
import { notifyPortfolioReport, submitPortfolioReport } from "@rezumi/api/features/portfolio/report";
import { PORTFOLIO_ITEM_ID_PATTERN } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_EVENT_KINDS } from "@rezumi/schema/portfolio/statistics";
import { isSpeculative, runAfterResponse } from "../static/portfolio-page";

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const notFound = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** A beacon's body: `{"kind": …, "id": …}`, sent as text so a browser needs no preflight. Null when it isn't one. */
export function parsePortfolioEvent(body: string): { kind: PortfolioEventKind; id?: string } | null {
	let value: unknown;
	try {
		value = JSON.parse(body);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) return null;
	const { kind, id } = value as { kind?: unknown; id?: unknown };
	const known = PORTFOLIO_EVENT_KINDS.find((name) => name === kind);
	if (!known) return null;
	if (known !== "work") return { kind: known };
	return typeof id === "string" && PORTFOLIO_ITEM_ID_PATTERN.test(id) ? { kind: known, id } : null;
}

/** `POST /api/portfolio/<username>/event`: counted after answering, so a page's beacon never waits on the database. */
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
	await runAfterResponse(
		recordPortfolioEvent({
			target,
			kind: event.kind,
			workId: event.id,
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
async function submitSafely(username: string, form: Record<string, unknown>, trustedClient: string) {
	try {
		return await submitPortfolioMessage({ username, form, trustedClient });
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
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
	const headers = { "Cache-Control": "no-store" };
	const form = await readForm(request);
	const result = form ? await submitSafely(username, form, trustedClient) : ({ ok: false, code: "invalid" } as const);
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
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const form = await readForm(request);
	const result = form
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
