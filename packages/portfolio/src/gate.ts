import type { PortfolioPageMessages } from "./messages";
import { escapeHtml } from "@rezumi/utils/string";

/**
 * The plain pages a portfolio shows instead of itself (Phase 13): the password page of a portfolio that has one (B16),
 * and the page of a work it no longer has (B2). No script, nothing of the portfolio's own, every text escaped.
 * Phase 13 Langkah 0: the final signatures with bare markup; `pf-render` gives them their styles and layout.
 */

type PlainPage = { lang: string; dir: "ltr" | "rtl"; title: string; body: string };

function plainDocument(page: PlainPage): string {
	return `<!doctype html><html lang="${escapeHtml(page.lang)}" dir="${page.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(page.title)}</title></head><body><main>${page.body}</main></body></html>`;
}

export function renderPortfolioLockPage(input: {
	lang: string;
	dir: "ltr" | "rtl";
	/** Where the form posts: `/api/portfolio/<username>/unlock`. */
	action: string;
	/** The form's `next` value: `home`, `report` or `work:<slug>`. */
	next: string;
	status?: "wrong" | "limited" | undefined;
	/** `?report` on this domain. */
	reportUrl: string;
	messages: PortfolioPageMessages;
}): string {
	const { messages } = input;
	const alert =
		input.status === "wrong" ? messages.wrongPassword : input.status === "limited" ? messages.tooManyTries : undefined;
	return plainDocument({
		lang: input.lang,
		dir: input.dir,
		title: messages.lockedTitle,
		body: [
			`<h1>${escapeHtml(messages.lockedTitle)}</h1>`,
			`<p>${escapeHtml(messages.lockedIntro)}</p>`,
			alert ? `<p role="alert">${escapeHtml(alert)}</p>` : "",
			`<form method="post" action="${escapeHtml(input.action)}">`,
			`<input type="hidden" name="next" value="${escapeHtml(input.next)}">`,
			`<label for="pf-password">${escapeHtml(messages.password)}</label>`,
			`<input id="pf-password" type="password" name="password" autocomplete="current-password" minlength="6" maxlength="64" required>`,
			`<button type="submit">${escapeHtml(messages.unlock)}</button>`,
			`</form>`,
			`<p><a href="${escapeHtml(input.reportUrl)}">${escapeHtml(messages.report)}</a></p>`,
		].join(""),
	});
}

export function renderPortfolioMissingWorkPage(input: {
	lang: string;
	dir: "ltr" | "rtl";
	/** The portfolio's home on this domain. */
	homeUrl: string;
	messages: PortfolioPageMessages;
}): string {
	const { messages } = input;
	return plainDocument({
		lang: input.lang,
		dir: input.dir,
		title: messages.workMissing,
		body: `<h1>${escapeHtml(messages.workMissing)}</h1><p><a href="${escapeHtml(input.homeUrl)}">${escapeHtml(messages.reportBack)}</a></p>`,
	});
}
