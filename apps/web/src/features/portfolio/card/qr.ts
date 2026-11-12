import { PORTFOLIO_QR_UTM_SOURCE } from "@rezumi/schema/portfolio/statistics";

/**
 * Where the business card's QR code leads, and the address printed beside it. The code adds `utm_source=qr`, so the
 * portfolio's statistics show visits from it (`02-teknis.md`, Phase 13 3.2); the printed address has no scheme, no
 * parameter and no trailing slash.
 */
export function businessCardAddress(pageUrl: string): { qr: string; shown: string } {
	const url = new URL(pageUrl);
	url.hash = "";
	url.search = "";
	const shown = `${url.host}${url.pathname}`.replace(/\/+$/, "");
	url.searchParams.set("utm_source", PORTFOLIO_QR_UTM_SOURCE);
	return { qr: url.toString(), shown };
}

/** A file name from a username: letters, digits and dashes only. */
export function cardFileName(username: string, extension: string): string {
	const base =
		username
			.toLowerCase()
			.replace(/[^\da-z-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "portfolio";
	return `${base}-qr.${extension}`;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

type PrintSheetInput = {
	name: string;
	headline: string;
	/** The QR code as SVG markup, made by `qrcode.react` in the app. */
	qrSvg: string;
	address: string;
	caption: string;
	title: string;
	lang: string;
};

/** How many cards an A4 sheet holds: two across, five down, 85 × 55 mm each. */
export const CARDS_PER_SHEET = 10;

/**
 * An A4 page with ten business cards (85 × 55 mm, the common Indonesian and European size) and dashed cutting lines,
 * as a document of its own for the browser's print dialog. Everything the person typed is escaped; the QR is the SVG
 * the app drew.
 */
export function businessCardPrintSheet({ name, headline, qrSvg, address, caption, title, lang }: PrintSheetInput) {
	const card = `<div class="card"><div class="text"><p class="name">${escapeHtml(name)}</p>${
		headline ? `<p class="headline">${escapeHtml(headline)}</p>` : ""
	}<p class="caption">${escapeHtml(caption)}</p><p class="address">${escapeHtml(address)}</p></div><div class="qr">${qrSvg}</div></div>`;
	return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:#111;font:10pt/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;height:297mm;padding:11mm 20mm;display:grid;grid-template-columns:repeat(2,85mm);grid-auto-rows:55mm}
.card{display:flex;align-items:center;gap:4mm;padding:5mm;border:0.2mm dashed #999;overflow:hidden}
.text{flex:1;min-width:0}
.name{margin:0;font-size:13pt;font-weight:700;overflow-wrap:anywhere}
.headline{margin:1mm 0 0;color:#444;overflow-wrap:anywhere}
.caption{margin:3mm 0 0;font-size:8pt;color:#555}
.address{margin:0.5mm 0 0;font-size:8pt;font-family:ui-monospace,monospace;overflow-wrap:anywhere}
.qr{width:30mm;height:30mm;flex:none}
.qr svg{width:100%;height:100%;display:block}
</style></head><body><div class="sheet">${card.repeat(CARDS_PER_SHEET)}</div></body></html>`;
}
