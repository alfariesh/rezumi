import { describe, expect, it } from "vite-plus/test";
import {
	dayInTimeZone,
	deviceClass,
	lastDays,
	normalizeCountry,
	referrerDomain,
	startOfDayInTimeZone,
	visitorKey,
	visitSource,
} from "./traffic";

const own = new Set(["rezumi.app"]);
const source = (referer: string | null, utmSource: string | null = null) =>
	visitSource({ referer, utmSource, ownHosts: own });

describe("visitSource", () => {
	it.each([
		["https://www.linkedin.com/feed/", "linkedin"],
		["https://id.linkedin.com/in/x", "linkedin"],
		["https://lnkd.in/abc", "linkedin"],
		["android-app://com.linkedin.android/", "linkedin"],
		["https://wa.me/628123", "whatsapp"],
		["https://web.whatsapp.com/", "whatsapp"],
		["android-app://com.whatsapp/", "whatsapp"],
		["https://www.google.com/", "google"],
		["https://www.google.co.id/search", "google"],
		["android-app://com.google.android.googlequicksearchbox/", "google"],
		["https://twitter.com/x", "other"],
		["https://notgoogle.example/", "other"],
		["https://rezumi.app/nadia", "direct"],
		[null, "direct"],
		["not a url", "direct"],
	])("maps %s to %s", (referer, expected) => {
		expect(source(referer)).toBe(expected);
	});

	it("prefers utm_source, and calls an unknown one other", () => {
		expect(source("https://www.google.com/", "whatsapp")).toBe("whatsapp");
		expect(source(null, "LinkedIn")).toBe("linkedin");
		expect(source(null, "newsletter")).toBe("other");
	});
});

describe("referrerDomain", () => {
	it("keeps only the site, without www, and nothing for this site", () => {
		expect(referrerDomain("https://www.Example.com/secret/path?q=1", own)).toBe("example.com");
		expect(referrerDomain("https://rezumi.app/nadia", own)).toBe("");
		expect(referrerDomain(null, own)).toBe("");
	});
});

describe("visitorKey", () => {
	const headers = (agent: string) => new Headers({ "user-agent": agent, "accept-language": "id" });

	it("tells browsers on one address apart and keeps no address readable", () => {
		const first = visitorKey(headers("Phone A"), "203.0.113.9");
		expect(first).not.toBe(visitorKey(headers("Phone B"), "203.0.113.9"));
		expect(first).toBe(visitorKey(headers("Phone A"), "203.0.113.9"));
		expect(first).not.toContain("203.0.113.9");
		expect(first).toMatch(/^[\da-f]{32}$/);
	});

	it("still works without a trusted address", () => {
		expect(visitorKey(headers("Phone A"))).not.toBe(visitorKey(headers("Phone B")));
	});
});

describe("deviceClass", () => {
	const of = (agent: string) => deviceClass(new Headers({ "user-agent": agent }));

	it("reads phones, tablets and everything else", () => {
		expect(of("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("mobile");
		expect(of("Mozilla/5.0 (Linux; Android 14; SM-A15) Mobile Safari")).toBe("mobile");
		expect(of("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
		expect(of("Mozilla/5.0 (Linux; Android 14; SM-T520) Safari")).toBe("tablet");
		expect(of("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
		expect(deviceClass(new Headers({ "sec-ch-ua-mobile": "?1" }))).toBe("mobile");
	});
});

describe("days", () => {
	it("follow the owner's time zone, so early morning in Jakarta is that day", () => {
		const at = new Date("2026-11-09T18:30:00Z");
		expect(dayInTimeZone(at, "Asia/Jakarta")).toBe("2026-11-10");
		expect(dayInTimeZone(at, "UTC")).toBe("2026-11-09");
	});

	it("treat an unknown zone as UTC", () => {
		expect(dayInTimeZone(new Date("2026-11-09T18:30:00Z"), "Not/AZone")).toBe("2026-11-09");
	});

	it("list the last days oldest first, across a month's end", () => {
		const days = lastDays(new Date("2026-12-02T01:00:00Z"), "UTC", 3);
		expect(days).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
		expect(lastDays(new Date("2026-12-02T01:00:00Z"), "UTC", 30)).toHaveLength(30);
	});
});

describe("normalizeCountry", () => {
	it("keeps two-letter codes and drops Cloudflare's unknown and Tor values", () => {
		expect(normalizeCountry("id")).toBe("ID");
		expect(normalizeCountry("XX")).toBe("");
		expect(normalizeCountry("T1")).toBe("");
		expect(normalizeCountry(undefined)).toBe("");
	});
});

describe("startOfDayInTimeZone", () => {
	it("finds local midnight, daylight saving included", () => {
		expect(startOfDayInTimeZone("2026-11-09", "UTC").toISOString()).toBe("2026-11-09T00:00:00.000Z");
		expect(startOfDayInTimeZone("2026-11-09", "Asia/Jakarta").toISOString()).toBe("2026-11-08T17:00:00.000Z");
		expect(startOfDayInTimeZone("2026-07-01", "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z");
		expect(startOfDayInTimeZone("2026-12-01", "America/New_York").toISOString()).toBe("2026-12-01T05:00:00.000Z");
		expect(startOfDayInTimeZone("2026-11-09", "Not/AZone").toISOString()).toBe("2026-11-09T00:00:00.000Z");
	});
});

describe("the QR code's visits", () => {
	it("read utm_source=qr as the QR source, whatever site referred them", () => {
		const own = new Set(["rezumi.app"]);
		expect(visitSource({ referer: null, utmSource: "qr", ownHosts: own })).toBe("qr");
		expect(visitSource({ referer: "https://www.google.com/", utmSource: "QR", ownHosts: own })).toBe("qr");
		expect(visitSource({ referer: null, utmSource: "qrcode", ownHosts: own })).toBe("other");
	});
});
