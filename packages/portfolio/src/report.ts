import type { PortfolioPageMessages } from "./messages";
import { escapeHtml } from "@rezumi/utils/string";
import { fillPortfolioMessage } from "./messages";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

const CSS = `:root{color-scheme:light dark;--bg:#f7f7f5;--card:#fff;--text:#1c1c1a;--muted:#62625c;--line:#d9d9d3;--accent:#1c1c1a;--on-accent:#fff;--ok:#146c43;--bad:#b02a37}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--text:#f2f2ef;--muted:#a9a9a2;--line:#3a3a36;--accent:#f2f2ef;--on-accent:#141413;--ok:#75d6a6;--bad:#ff9aa5}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:0 auto;padding:32px 16px 48px}
h1{font-size:1.5rem;line-height:1.25;margin:0 0 8px}
p{margin:0}
.intro{color:var(--muted);margin-bottom:24px}
form,.done{display:grid;gap:18px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px}
fieldset{border:0;margin:0;padding:0;display:grid;gap:8px}
legend,label.field{font-weight:600;padding:0;margin-bottom:6px}
.choice{display:flex;gap:10px;align-items:flex-start;min-height:28px}
.choice input{margin:4px 0 0}
.field-wrap{display:grid;gap:2px}
input[type=email],textarea{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:8px;padding:10px 12px}
textarea{min-height:130px;resize:vertical}
.note{color:var(--muted);font-size:.875rem}
button{justify-self:start;font:inherit;font-weight:600;color:var(--on-accent);background:var(--accent);border:0;border-radius:8px;padding:10px 18px;cursor:pointer}
a{color:inherit}
.back{display:inline-block;margin-top:20px}
.status{font-weight:600}
.status[data-ok]{color:var(--ok)}
.status:not([data-ok]){color:var(--bad)}
.trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}`;

export type RenderPortfolioReportPageInput = {
	lang: string;
	dir: "ltr" | "rtl";
	/** The person whose portfolio this is. */
	name: string;
	/** The portfolio's own address, for the way back. */
	pageUrl: string;
	/** Where the form posts: `/api/portfolio/<username>/report`. */
	action: string;
	/** Turnstile's public site key; null while the keys aren't set, and the page then gives an email address instead. */
	siteKey: string | null;
	/** The result of the last send, from `?report=` on the address. */
	status?: "sent" | "failed" | undefined;
	supportEmail: string;
	messages: PortfolioPageMessages;
};

/**
 * The report form on a plain page of its own (`02-teknis.md` section 14): a form post, so it needs no script of ours;
 * only Turnstile's. Nothing the portfolio's owner wrote is drawn here but their name, escaped.
 */
export function renderPortfolioReportPage(input: RenderPortfolioReportPageInput): string {
	const { messages: m, status } = input;
	const email = escapeHtml(input.supportEmail);
	const mail = `<a href="mailto:${email}">${email}</a>`;
	const reasons: [string, string][] = [
		["fraud", m.reportReasonFraud],
		["illegal", m.reportReasonIllegal],
		["rights", m.reportReasonRights],
		["fake_testimonial", m.reportReasonFakeTestimonial],
		["other", m.reportReasonOther],
	];
	const statusLine = status === "failed" ? `<p class="status" role="alert">${escapeHtml(m.reportFailed)}</p>` : "";
	const form = input.siteKey
		? `<form method="post" action="${escapeHtml(input.action)}">
${statusLine}
<fieldset><legend>${escapeHtml(m.reportReason)}</legend>
${reasons
	.map(
		([value, label], index) =>
			`<label class="choice"><input type="radio" name="reason" value="${value}" required${index === 0 ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`,
	)
	.join("")}
</fieldset>
<div class="field-wrap"><label class="field" for="details">${escapeHtml(m.reportDetails)}</label>
<textarea id="details" name="details" required maxlength="2000"></textarea></div>
<div class="field-wrap"><label class="field" for="email">${escapeHtml(m.reportEmail)}</label>
<input id="email" name="email" type="email" autocomplete="email" maxlength="254">
<p class="note">${escapeHtml(m.reportEmailNote)}</p></div>
<div class="trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="cf-turnstile" data-sitekey="${escapeHtml(input.siteKey)}" data-theme="auto" data-size="flexible"></div>
<noscript><p class="note">${fillPortfolioMessage(escapeHtml(m.reportNeedsScript), { email: mail })}</p></noscript>
<button type="submit">${escapeHtml(m.reportSend)}</button>
</form>
<script src="${TURNSTILE_SCRIPT}" async defer></script>`
		: `<div class="done"><p>${fillPortfolioMessage(escapeHtml(m.reportClosed), { email: mail })}</p></div>`;
	const body =
		status === "sent"
			? `<div class="done"><p class="status" data-ok role="status">${escapeHtml(m.reportSent)}</p></div>`
			: form;
	return `<!doctype html><html lang="${escapeHtml(input.lang)}" dir="${input.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(m.reportTitle)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>${CSS}</style></head><body><main><h1>${escapeHtml(m.reportTitle)}</h1><p class="intro">${escapeHtml(fillPortfolioMessage(m.reportIntro, { name: input.name }))}</p>${body}<a class="back" href="${escapeHtml(input.pageUrl)}">${escapeHtml(m.reportBack)}</a></main></body></html>`;
}
