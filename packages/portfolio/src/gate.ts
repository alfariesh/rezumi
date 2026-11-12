import type { PortfolioPageMessages } from "./messages";
import { escapeHtml } from "@rezumi/utils/string";

/**
 * The plain pages a portfolio shows instead of itself (Phase 13): the password page of a portfolio that has one (B16),
 * and the page of a work it no longer has (B2). Like the report page (`report.ts`): their own small styles in light and
 * dark, no script, nothing of the portfolio's own (no name, photo or theme), every text escaped, and kept out of
 * search engines.
 */

const CSS = `:root{color-scheme:light dark;--bg:#f7f7f5;--card:#fff;--text:#1c1c1a;--muted:#62625c;--line:#d9d9d3;--accent:#1c1c1a;--on-accent:#fff;--bad:#b02a37;--focus:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--text:#f2f2ef;--muted:#a9a9a2;--line:#3a3a36;--accent:#f2f2ef;--on-accent:#141413;--bad:#ff9aa5;--focus:#93b4ff}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:100%;max-width:440px;padding:32px 16px 48px;overflow-wrap:anywhere}
/* Text in another direction than the page (an English fallback on an Arabic page) keeps its own: each block takes it from its first letter. */
h1,p,label{unicode-bidi:plaintext}
h1{font-size:1.5rem;line-height:1.25;margin:0 0 8px}
p{margin:0}
.intro{color:var(--muted);margin-bottom:24px}
form{display:grid;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px}
label{font-weight:600}
input{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:8px;padding:10px 12px}
button{justify-self:start;margin-top:8px;font:inherit;font-weight:600;color:var(--on-accent);background:var(--accent);border:0;border-radius:8px;padding:10px 18px;cursor:pointer}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.alert{font-weight:600;color:var(--bad)}
a{color:inherit;text-underline-offset:3px}
.foot{margin-top:20px;color:var(--muted);font-size:.875rem}`;

type PlainPage = { lang: string; dir: "ltr" | "rtl"; title: string; body: string };

function plainDocument(page: PlainPage): string {
	return `<!doctype html><html lang="${escapeHtml(page.lang)}" dir="${page.dir === "rtl" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(page.title)}</title><style>${CSS}</style></head><body><main>${page.body}</main></body></html>`;
}

/**
 * The page a password-protected portfolio shows a visitor without access: a general title, the password field and
 * the button that opens the portfolio, an error when the last try was wrong or one too many, and the Report link.
 * The form posts to `action` with `next`, which the server turns into the page asked for.
 */
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
			`<p class="intro">${escapeHtml(messages.lockedIntro)}</p>`,
			`<form method="post" action="${escapeHtml(input.action)}">`,
			`<input type="hidden" name="next" value="${escapeHtml(input.next)}">`,
			`<label for="pf-password">${escapeHtml(messages.password)}</label>`,
			`<input id="pf-password" type="password" name="password" autocomplete="current-password" minlength="6" maxlength="64" required${alert ? ' aria-invalid="true" aria-describedby="pf-password-alert"' : ""}>`,
			alert ? `<p class="alert" id="pf-password-alert" role="alert">${escapeHtml(alert)}</p>` : "",
			`<button type="submit">${escapeHtml(messages.unlock)}</button>`,
			`</form>`,
			`<p class="foot"><a href="${escapeHtml(input.reportUrl)}" rel="nofollow">${escapeHtml(messages.report)}</a></p>`,
		].join(""),
	});
}

/** The page of a work the portfolio no longer has (hidden, removed, untitled): a short note and a link to the portfolio. */
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
		body: `<h1>${escapeHtml(messages.workMissing)}</h1><p class="foot"><a href="${escapeHtml(input.homeUrl)}">${escapeHtml(messages.reportBack)}</a></p>`,
	});
}
