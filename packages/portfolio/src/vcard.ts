import type { PortfolioView } from "./view";

/** vCard text values escape a backslash, a comma, a semicolon and a line break (RFC 2426 section 4). */
function escapeValue(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll(",", "\\,")
		.replaceAll(";", "\\;")
		.replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * A content line folded at 75 octets (RFC 2425 section 5.8.1): each continuation starts with one space, which counts
 * towards its 75. A line is cut only between characters, never inside a character's UTF-8 bytes.
 */
function fold(line: string): string {
	const parts: string[] = [];
	let current = "";
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = parts.length ? 74 : 75;
		if (size + bytes > limit) {
			parts.push(current);
			current = "";
			size = 0;
		}
		current += char;
		size += bytes;
	}
	parts.push(current);
	return parts.join("\r\n ");
}

/**
 * The "Save contact" card (Phase 13 B14): a vCard 3.0 of what the page already shows, read from the view, so the
 * portfolio's own privacy settings apply by themselves. The name and headline; the email, WhatsApp number and phone
 * only while Contact is on the page and shows them; the portfolio's address, then the website and profiles Contact
 * links to (each address once); the place the intro names. No photo, street address or note. Lines end in CRLF and
 * fold at 75 octets.
 */
export function buildPortfolioVcard(view: PortfolioView, input: { url: string }): string {
	const name = escapeValue(view.basics.name);
	const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:;${name};;;`, `FN:${name}`];
	if (view.basics.headline) lines.push(`TITLE:${escapeValue(view.basics.headline)}`);

	const section = view.sections.find((item) => item.kind === "contact");
	const contact = section?.kind === "contact" ? section.contact : null;
	if (contact?.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(contact.email)}`);
	if (contact?.whatsapp) lines.push(`TEL;TYPE=CELL:+${escapeValue(contact.whatsapp.number)}`);
	// A phone that is the WhatsApp number again is left out: one number, saved once.
	if (contact?.phone && contact.phone.replace(/\D/g, "") !== contact.whatsapp?.number)
		lines.push(`TEL;TYPE=VOICE:${escapeValue(contact.phone)}`);

	const urls = new Set([input.url]);
	if (contact?.website) urls.add(contact.website.href);
	for (const profile of contact?.profiles ?? []) if (profile.href) urls.add(profile.href);
	for (const url of urls) lines.push(`URL:${escapeValue(url)}`);

	// Where the intro says the person is (`introLocation`): empty when the portfolio hides the place.
	const place = view.location?.label || view.basics.location;
	if (place) lines.push(`ADR;TYPE=WORK:;;;${escapeValue(place)};;;`);

	lines.push("END:VCARD");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
