import type { PortfolioView } from "./view";

/**
 * The "Save contact" card (Phase 13, B14): a vCard 3.0 of what the page already shows, read from the view, so the
 * portfolio's privacy settings apply by themselves. Phase 13 Langkah 0: name, headline and the portfolio's address
 * only; `pf-render` adds the contact details, the location and line folding (contract section 3.2).
 */
export function buildPortfolioVcard(view: PortfolioView, input: { url: string }): string {
	const escape = (value: string) =>
		value
			.replaceAll("\\", "\\\\")
			.replaceAll(",", "\\,")
			.replaceAll(";", ";")
			.replace(/\r\n|\r|\n/g, "\\n");
	const name = escape(view.basics.name);
	const lines = [
		"BEGIN:VCARD",
		"VERSION:3.0",
		`N:;${name};;;`,
		`FN:${name}`,
		...(view.basics.headline ? [`TITLE:${escape(view.basics.headline)}`] : []),
		`URL:${escape(input.url)}`,
		"END:VCARD",
	];
	return `${lines.join("\r\n")}\r\n`;
}
