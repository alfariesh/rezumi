import type { WebPageMessages } from "./messages";
import type { ResumeWebPage } from "./web-page";
import { isRTL } from "@rezumi/utils/locale";
import { escapeHtml } from "@rezumi/utils/string";

export { localeFromAcceptLanguage, webPageMessages } from "./messages";
export type { WebPageMessages } from "./messages";

export type WebPageHead = {
	title: string;
	description: string;
	/** The page's one address; search engines are pointed here. */
	canonicalUrl: string;
	indexable: boolean;
	imageUrl?: string | undefined;
	structuredData?: Record<string, unknown> | undefined;
};

export type WebPageDocumentOptions = {
	page: ResumeWebPage;
	/** Absent in the editor's preview, which nothing indexes or shares. */
	head?: WebPageHead | undefined;
	messages: WebPageMessages;
	/** The PDF's address, when the owner allows downloads. */
	downloadUrl?: string | undefined;
	/** Where the footer credit links; absent when the owner turned it off. */
	creditUrl?: string | undefined;
};

/**
 * The desk around the sheet, the floating actions and the footer. Phones pin the actions to the bottom edge, so the
 * page leaves room for them.
 */
const SHELL_CSS = `
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#ececef;color:#111;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.rr.rr-desk{padding:40px 16px 112px}
.rr-page{box-shadow:0 1px 2px rgb(0 0 0/.06),0 8px 32px rgb(0 0 0/.08)}
.rr-actions a:focus-visible,.rr-actions button:focus-visible,.rr .rr-credit:focus-visible{outline:2px solid #2563eb;outline-offset:4px}
.rr .rr-credit{display:flex;flex-direction:column;align-items:center;gap:6px;width:max-content;margin:36px auto 0;color:#8e8e96;opacity:.7;text-decoration:none;font:500 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.02em;border-radius:6px;transition:opacity .2s,color .2s}
.rr .rr-credit svg{width:18px;height:18px}
.rr .rr-credit:hover{opacity:1;color:#3f3f46}
.rr-actions{position:fixed;right:24px;bottom:24px;display:flex;gap:8px;z-index:10}
.rr-actions a,.rr-actions button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;font:500 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;background:#fff;color:#111;box-shadow:0 1px 2px rgb(0 0 0/.08),0 4px 16px rgb(0 0 0/.12)}
.rr-actions .rr-primary{background:#111;color:#fff}
.rr-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:#111;color:#fff;font:500 14px system-ui,sans-serif;padding:10px 16px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}
.rr-toast[data-on]{opacity:1}
@media (max-width:640px){
.rr.rr-desk{padding:0 0 96px}
.rr-page{box-shadow:none}
.rr-actions{left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgb(255 255 255/.92);backdrop-filter:blur(12px);box-shadow:0 -1px 0 rgb(0 0 0/.08)}
.rr-actions a,.rr-actions button{flex:1;justify-content:center;height:48px;font-size:16px;box-shadow:none;border:1px solid rgb(0 0 0/.12)}
.rr-actions .rr-primary{border-color:#111}
}
@media print{body{background:#fff}.rr.rr-desk{padding:0}.rr-page{box-shadow:none}.rr-actions,.rr-credit,.rr-toast{display:none}}
`;

const MESSAGE_CSS = `
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ececef;color:#111;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
main{max-width:380px;text-align:center;display:grid;gap:12px}
h1{font-size:24px;line-height:1.25;margin:0;font-weight:600}
p{margin:0;color:#4b4b52;font-size:15px;line-height:1.5}
form{display:grid;gap:12px;margin-top:12px;text-align:start}
label{font-size:14px;font-weight:500}
input{font:inherit;height:44px;padding:0 12px;border:1px solid #c9c9d0;border-radius:8px;background:#fff}
input:focus{outline:2px solid #2563eb;outline-offset:1px}
button{font:inherit;font-weight:600;height:44px;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer}
.error{color:#b42318;font-size:14px}
`;

/**
 * The page's one script: Share opens the system share sheet or copies the link. Its text is fixed, so the server's
 * policy can allow it by hash.
 */
export const WEB_PAGE_SCRIPT = `(()=>{const d=document,t=d.querySelector(".rr-toast");const toast=()=>{if(!t)return;t.setAttribute("data-on","");setTimeout(()=>t.removeAttribute("data-on"),1600)};d.querySelector("[data-share]")?.addEventListener("click",async()=>{const url=location.href;if(navigator.share){try{await navigator.share({title:d.title,url})}catch{}return}try{await navigator.clipboard.writeText(url);toast()}catch{}})})();`;

/** The Rezumi mark, drawn in the credit's colour. */
const LOGO =
	'<svg viewBox="17.25 -12.7 36 36" aria-hidden="true" focusable="false"><path fill="currentColor" opacity=".4" transform="translate(48 0) scale(-1 1)" d="M20.434 3.63c.415.415.772.773 1.027 1.096.271.345.489.728.531 1.202a1.74 1.74 0 0 1 0 .403c-.042.473-.26.856-.531 1.201-.255.324-.612.682-1.027 1.097l-1.122 1.122-5.061-5.061 1.122-1.122c.415-.415.773-.773 1.097-1.027.345-.272.727-.489 1.201-.531a1.74 1.74 0 0 1 .403 0c.474.042.856.259 1.202.531.323.254.743.674 1.158 1.089ZM18.251 10.811l-7.813 7.814c-.769.769-1.303 1.303-1.994 1.59-.692.286-1.448.286-2.536.286H4.251a.75.75 0 0 1-.75-.75v-1.658c0-1.087-.001-1.843.285-2.535.287-.691.822-1.226 1.591-1.995l7.814-7.812 5.06 5.06Z"/><path fill="currentColor" transform="translate(48 0) scale(-1 1)" d="M18.074 2.009c.474.043.856.259 1.202.53.323.255.743.674 1.158 1.089s.772.773 1.027 1.097c.271.345.489.727.531 1.201.012.134.012.27 0 .404-.042.474-.26.856-.531 1.202-.255.323-.612.681-1.027 1.096l-1.122 1.121-5.061-5.06 1.122-1.121c.415-.415.773-.774 1.097-1.029.345-.271.727-.487 1.201-.53.134-.012.269-.012.403 0Z"/><path fill="currentColor" d="M38.712-9.872c11.815 1.207 15.452 14.746 5.807 20.069-.759.365-1.213.531-2.016.804-1.865-1.7-3.756-3.524-5.587-5.267 2.788-.019 5.934-1.596 5.817-4.581-.27-6.946-11.958-2.771-16.048-4.479-2.069-.862-6.033-5.023-7.686-6.585z"/></svg>';

/** OpenGraph and Twitter card tags, for the web pages and the app's own pages. Every value must already be HTML-escaped. */
export function socialMetaTags(tags: {
	type: string;
	title: string;
	description: string;
	url: string;
	image?: string | undefined;
}) {
	return [
		`<meta property="og:type" content="${tags.type}">`,
		`<meta property="og:site_name" content="Rezumi">`,
		`<meta property="og:title" content="${tags.title}">`,
		`<meta property="og:description" content="${tags.description}">`,
		`<meta property="og:url" content="${tags.url}">`,
		tags.image ? `<meta property="og:image" content="${tags.image}">` : "",
		`<meta name="twitter:card" content="${tags.image ? "summary_large_image" : "summary"}">`,
		`<meta name="twitter:title" content="${tags.title}">`,
		`<meta name="twitter:description" content="${tags.description}">`,
		tags.image ? `<meta name="twitter:image" content="${tags.image}">` : "",
	].join("");
}

/** Structured data for search engines, safe inside a `<script>`. */
export const jsonLdScript = (data: unknown) =>
	`<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;

const metaTags = (head: WebPageHead | undefined) => {
	if (!head) return "";
	const title = escapeHtml(head.title);
	const description = escapeHtml(head.description);
	const url = escapeHtml(head.canonicalUrl);
	return [
		`<title>${title}</title>`,
		`<meta name="description" content="${description}">`,
		`<link rel="canonical" href="${url}">`,
		head.indexable ? "" : `<meta name="robots" content="noindex, follow">`,
		socialMetaTags({
			type: "profile",
			title,
			description,
			url,
			image: head.imageUrl ? escapeHtml(head.imageUrl) : undefined,
		}),
		head.structuredData ? jsonLdScript(head.structuredData) : "",
	].join("");
};

const shell = (lang: string, head: string, css: string, body: string) =>
	`<!doctype html><html lang="${escapeHtml(lang)}" dir="${isRTL(lang) ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">${head}<style>${css}</style></head><body>${body}</body></html>`;

/** A resume's whole web page, ready to send. */
export function renderWebPageDocument({
	page,
	head,
	messages,
	downloadUrl,
	creditUrl,
}: WebPageDocumentOptions): string {
	const download = downloadUrl
		? `<a class="rr-primary" href="${escapeHtml(downloadUrl)}" download>${escapeHtml(messages.downloadPdf)}</a>`
		: "";
	const body = [
		`<main id="main-content" class="rr rr-desk">${page.html}`,
		creditUrl
			? `<a class="rr-credit" href="${escapeHtml(creditUrl)}" aria-label="${escapeHtml(messages.credit)}" title="${escapeHtml(messages.credit)}">${LOGO}<span aria-hidden="true">Rezumi</span></a>`
			: "",
		"</main>",
		`<div class="rr-actions">${download}<button type="button" data-share>${escapeHtml(messages.share)}</button></div>`,
		`<div class="rr-toast" role="status" aria-live="polite">${escapeHtml(messages.linkCopied)}</div>`,
		`<script>${WEB_PAGE_SCRIPT}</script>`,
	].join("");
	return shell(page.lang, metaTags(head), `${SHELL_CSS}${page.css}`, body);
}

/** The page a password-protected resume shows until the visitor unlocks it. */
export function renderPasswordDocument(options: {
	lang: string;
	messages: WebPageMessages;
	wrongPassword: boolean;
}): string {
	const { messages } = options;
	const error = options.wrongPassword ? `<p class="error" id="error">${escapeHtml(messages.wrongPassword)}</p>` : "";
	const body = `<main><h1>${escapeHtml(messages.passwordTitle)}</h1><p>${escapeHtml(messages.passwordHint)}</p><form method="post"><label for="password">${escapeHtml(messages.password)}</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="6" maxlength="64" required autofocus${options.wrongPassword ? ' aria-invalid="true" aria-describedby="error"' : ""}>${error}<button type="submit">${escapeHtml(messages.unlock)}</button></form></main>`;
	return shell(
		options.lang,
		`<title>${escapeHtml(messages.passwordTitle)}</title><meta name="robots" content="noindex, nofollow">`,
		MESSAGE_CSS,
		body,
	);
}

/** Off, unknown or trashed resumes read the same, with nothing about the owner. */
export function renderUnavailableDocument(options: { lang: string; messages: WebPageMessages }): string {
	const { messages } = options;
	return shell(
		options.lang,
		`<title>${escapeHtml(messages.unavailableTitle)}</title><meta name="robots" content="noindex, nofollow">`,
		MESSAGE_CSS,
		`<main><h1>${escapeHtml(messages.unavailableTitle)}</h1><p>${escapeHtml(messages.unavailableHint)}</p></main>`,
	);
}
