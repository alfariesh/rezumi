import type { PortfolioDevice, PortfolioVisitSource } from "@rezumi/schema/portfolio/statistics";
import { createHash } from "node:crypto";

/**
 * Who a visit is, for one hour's deduplication: a hash of the client's address and browser. A hash so no address is
 * kept anywhere; with the browser so people sharing one carrier-grade NAT address (common on Indonesian mobile
 * networks) aren't merged into one visitor.
 */
export function visitorKey(headers: Headers, trustedClient?: string): string {
	const parts = [trustedClient?.trim() ?? "", headers.get("user-agent") ?? "", headers.get("accept-language") ?? ""];
	return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 32);
}

/** The visitor's device class, from the browser's own hints; no raw user agent leaves this function. */
export function deviceClass(headers: Headers): PortfolioDevice {
	const agent = headers.get("user-agent") ?? "";
	if (/\bipad\b|tablet|playbook|silk|android(?!.*mobile)/i.test(agent)) return "tablet";
	if (headers.get("sec-ch-ua-mobile") === "?1" || /mobi|iphone|ipod|android/i.test(agent)) return "mobile";
	return "desktop";
}

/** The site a referring address names, without `www.`; empty when there is none or it's this site. */
export function referrerDomain(referer: string | null, ownHosts: ReadonlySet<string>): string {
	if (!referer) return "";
	let host: string;
	try {
		host = new URL(referer).hostname.toLowerCase();
	} catch {
		return "";
	}
	if (ownHosts.has(host)) return "";
	return host.replace(/^www\./, "").slice(0, 253);
}

const LINKEDIN = /(?:^|\.)linkedin\.[a-z.]+$|^lnkd\.in$|^com\.linkedin\.android$/;
const WHATSAPP = /(?:^|\.)whatsapp\.com$|^wa\.me$|^com\.whatsapp(?:\.w4b)?$/;
const GOOGLE = /(?:^|\.)google\.[a-z.]+$|^com\.google\.android\.(?:googlequicksearchbox|gm)$/;

function sourceOfName(name: string): PortfolioVisitSource | null {
	if (name.includes("linkedin") || name === "lnkd") return "linkedin";
	if (name.includes("whatsapp") || name === "wa") return "whatsapp";
	if (name.includes("google")) return "google";
	return null;
}

/** Where a visit came from: its `utm_source` when it names one we know, then the site that referred it. */
export function visitSource(input: {
	referer: string | null;
	utmSource: string | null;
	ownHosts: ReadonlySet<string>;
}): PortfolioVisitSource {
	const utm = input.utmSource?.trim().toLowerCase().slice(0, 64);
	if (utm) return sourceOfName(utm) ?? "other";
	const domain = referrerDomain(input.referer, input.ownHosts);
	if (!domain) return "direct";
	if (LINKEDIN.test(domain)) return "linkedin";
	if (WHATSAPP.test(domain)) return "whatsapp";
	if (GOOGLE.test(domain)) return "google";
	return "other";
}

/** A two-letter country code, or empty for none or Cloudflare's "unknown" (XX) and Tor (T1) values. */
export function normalizeCountry(country: string | null | undefined): string {
	const code = country?.trim().toUpperCase() ?? "";
	return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : "";
}

/** The calendar date of a moment in a time zone, as `YYYY-MM-DD`; an unknown zone counts as UTC. */
export function dayInTimeZone(at: Date, timeZone: string): string {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(at);
	} catch {
		return at.toISOString().slice(0, 10);
	}
	const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The `count` calendar dates ending at the day of `at` in `timeZone`, oldest first. */
export function lastDays(at: Date, timeZone: string, count: number): string[] {
	const [year, month, day] = dayInTimeZone(at, timeZone).split("-").map(Number) as [number, number, number];
	const end = Date.UTC(year, month - 1, day);
	return Array.from({ length: count }, (_, index) =>
		new Date(end - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
	);
}
