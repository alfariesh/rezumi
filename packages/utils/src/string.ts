import { v7 as uuidv7 } from "uuid";

/**
 * Generates a unique ID using the UUIDv7 algorithm.
 * @returns The generated ID.
 */
export function generateId() {
	return uuidv7();
}

/**
 * Generates initials from a name.
 * @param name - The name to generate initials from.
 * @returns The initials.
 */
export function getInitials(name: string) {
	return name
		.split(" ")
		.map((n) => n[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/**
 * Transforms a string to a valid username (lowercase, no special characters except for dots, hyphens and underscores).
 * @param value - The value to transform.
 * @returns The transformed username.
 */
export function toUsername(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]/g, "")
		.slice(0, 64);
}

/**
 * The username a sign-up proposes when the person does not choose one (the mobile app's Create account): the email's
 * local part through `toUsername`, without hyphens (reserved for generated guest names), at most 20 characters, padded
 * to the 3-character minimum, then `suffix` (digits that make a taken name free). The account can change it later.
 */
export function usernameFromEmail(email: string, suffix = "") {
	const local = toUsername((email.split("@")[0] ?? "").replaceAll("-", ".")).replace(/^[._]+|[._]+$/g, "");
	const base = (local || "user").slice(0, 20).padEnd(3, "0");
	return `${base}${suffix}`;
}

/**
 * Strips HTML tags from a string and returns the text content.
 * @param html - The HTML string to strip.
 * @returns The text content without HTML tags.
 */
/** Text safe to place inside HTML: markup characters and both quote marks become entities. */
export const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

/** Lowercase text without accents, for loose matching: "Österreich" becomes "osterreich". */
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();

/** The options whose label contains the query, ignoring case and accents, or whose value is the whole query. */
export function filterOptions<T extends { value: string; label: string }>(options: readonly T[], query: string): T[] {
	const needle = fold(query.trim());
	if (!needle) return [...options];
	return options.filter((option) => fold(option.label).includes(needle) || fold(option.value) === needle);
}

export function stripHtml(html: string | undefined): string {
	if (!html) return "";
	return html.replace(/<[^<>]*>/g, "").trim();
}

/** FNV-1a over the text: a short, stable fingerprint. Not for security. */
export function fnv1a(text: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	return hash >>> 0;
}
