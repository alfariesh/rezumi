/**
 * Contact details a job posting's own text gives (an HR email, a phone or WhatsApp number), suggested in the browser
 * extension's save form and kept only when the person ticks them (.agents/docs/plans/plugin-browser/02-teknis.md
 * §19.2). Only the posting's text is read: never a person's profile. No Zod and no DOM, so any runtime can use it.
 */

export type SuggestedContact = { type: "email" | "phone"; value: string };

/** At most this many suggestions per posting. */
export const MAX_SUGGESTED_CONTACTS = 5;

const EMAIL =
	/[\w.%+-]{1,64}@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*\.([a-z]{2,24})\b/gi;
/** File names that look like addresses ("logo@2x.png"). */
const NOT_A_DOMAIN = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif"]);

/** WhatsApp links: `wa.me/628…`, `api.whatsapp.com/send?phone=628…`. */
const WHATSAPP_LINK = /(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=)\+?(\d{8,15})/gi;
/** Indonesian mobile numbers: `0812…`, `+62 812…`, `62812…`, with spaces, dots or dashes between groups. */
const INDONESIAN_MOBILE = /(?<![\d+])(?:\+62|62|0)[\s.-]?8\d{1,3}(?:[\s.-]?\d{2,5}){1,3}(?!\d)/g;
/** Any other number, only right after a word that says it is one ("Telp. (021) 555-0100", "WhatsApp: +65 …"). */
const LABELED_NUMBER =
	/\b(?:telp|telepon|tel|phone|ponsel|hp|wa|whatsapp|hubungi|contact|call)\b[^\d+\n]{0,12}(\+?\(?\d[\d\s().-]{6,18}\d)/gi;
/** A currency just before a number means pay, never a phone. */
const MONEY_BEFORE = /(?:rp|idr|usd|sgd|myr|\$|€|£)\.?\s*$/i;

const digitsOf = (text: string) => text.replace(/\D/g, "");

/** A number as `+<country><number>`; Indonesian `0…` becomes `+62…`. Null when it cannot be a phone number. */
function normalizePhone(raw: string): string | null {
	const digits = digitsOf(raw);
	const international = raw.trim().startsWith("+");
	let number: string;
	if (digits.startsWith("62")) number = digits;
	else if (digits.startsWith("0")) number = `62${digits.slice(1)}`;
	else if (international) number = digits;
	else return null;
	// E.164 allows 8–15 digits with the country code; Indonesian numbers have 9–13 after +62.
	if (number.length < 9 || number.length > 15) return null;
	if (number.startsWith("62") && (number.length < 11 || number.length > 15)) return null;
	return `+${number}`;
}

/**
 * Emails and phone numbers the posting's text states, in the order they appear, each once, at most five. Pay ("Rp
 * 8.000.000"), dates and plain counts are not numbers anyone can call, and are skipped.
 */
export function suggestContacts(text: string): SuggestedContact[] {
	const found: { at: number; contact: SuggestedContact }[] = [];
	const seen = new Set<string>();
	const add = (at: number, contact: SuggestedContact) => {
		const id = `${contact.type}:${contact.value}`;
		if (seen.has(id)) return;
		seen.add(id);
		found.push({ at, contact });
	};

	for (const match of text.matchAll(EMAIL)) {
		const domain = (match[1] ?? "").toLowerCase();
		if (NOT_A_DOMAIN.has(domain)) continue;
		add(match.index, { type: "email", value: match[0].toLowerCase().replace(/^[.%+-]+/, "") });
	}

	const phone = (at: number, raw: string) => {
		if (MONEY_BEFORE.test(text.slice(Math.max(0, at - 6), at))) return;
		const value = normalizePhone(raw);
		if (value) add(at, { type: "phone", value });
	};
	for (const match of text.matchAll(WHATSAPP_LINK)) phone(match.index, `+${match[1] ?? ""}`);
	for (const match of text.matchAll(INDONESIAN_MOBILE)) phone(match.index, match[0]);
	for (const match of text.matchAll(LABELED_NUMBER)) {
		const raw = match[1] ?? "";
		phone(match.index + match[0].length - raw.length, raw);
	}

	return found
		.toSorted((a, b) => a.at - b.at)
		.slice(0, MAX_SUGGESTED_CONTACTS)
		.map(({ contact }) => contact);
}
