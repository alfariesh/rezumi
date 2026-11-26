import type { JobEventKind } from "../events";
import type { TregDependencies } from "../treg";
import type { JobListingDraft, JobProvider, JobSeniority } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";
import { jobListingDraftSchema, MAX_JOB_DESCRIPTION_CHARS } from "@rezumi/schema/jobs/listing";
import { countryName, SEARCH_REGION_CODES } from "@rezumi/utils/region";
import { htmlToText } from "../../web/builtin";

/** A listing from a provider with the provider fields Rezumi keeps beside it (never a person's contact details). */
export type ProviderListing = JobListingDraft & { raw: Record<string, unknown> };

export type ProviderSearchOptions = {
	/** Listings per page; each one returned is paid for. */
	limit: number;
	kind?: JobEventKind;
	/** Skips treg's answer archive. */
	fresh?: boolean;
	/** Hirebase: only listings it first saw at or after this time (ISO), newest first. For job alerts. */
	ingestedAfter?: string;
	signal?: AbortSignal | undefined;
	treg?: TregDependencies;
};

export type ProviderSearchResult = {
	provider: JobProvider;
	listings: ProviderListing[];
	/** Passed back as `cursor` for the next page; missing on the last page. */
	cursor: string | undefined;
	/** Matches in all, when the provider says. */
	total: number | undefined;
	costMicro: number;
	ms: number;
	/** Listings the provider sent that were dropped as unusable (no title, no link). */
	dropped: number;
	/** JobsPipe: where a later "new since" check starts; given only on an answer's last page. */
	deltaCursor?: string | undefined;
};

export type JobSourceAdapter = {
	provider: JobProvider;
	/** US dollars for one listing returned. */
	pricePerListingUsd: number;
	search: (input: JobSearchInput, options: ProviderSearchOptions) => Promise<ProviderSearchResult>;
	/**
	 * Listings that became searchable since `deltaCursor` (a previous answer's `deltaCursor`), for job alerts. Only
	 * providers with a "new since" feed have it (JobsPipe); an answer with nothing new is free.
	 */
	newListings?: (
		input: JobSearchInput,
		deltaCursor: string,
		options: ProviderSearchOptions,
	) => Promise<ProviderSearchResult>;
	/** How many jobs match, from the provider's free count endpoint (JobsPipe stops counting at 10,000). */
	count: (
		input: JobSearchInput,
		options?: Pick<ProviderSearchOptions, "signal" | "treg">,
	) => Promise<number | undefined>;
};

/** A ceiling for the free count endpoints, so a price change can't turn them into a charge. */
export const COUNT_MAX_COST_USD = 0.001;

/** A cost ceiling for one call: the listings asked for at list price, plus headroom for rounding and repricing. */
export const maxCostUsd = (limit: number, pricePerListingUsd: number) => limit * pricePerListingUsd * 1.25 + 0.005;

type Unknown = Record<string, unknown>;
export const isRecord = (value: unknown): value is Unknown =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A trimmed, length-capped string, or undefined for anything empty or not a string. */
export function str(value: unknown, max = 500): string | undefined {
	if (typeof value !== "string") return undefined;
	const text = value.replace(/\s+/g, " ").trim();
	return text ? text.slice(0, max) : undefined;
}

export function bool(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

export function num(value: unknown): number | undefined {
	const number = typeof value === "string" && value.trim() ? Number(value) : value;
	return typeof number === "number" && Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function httpUrl(value: unknown): string | undefined {
	const text = str(value, 2_000);
	if (!text) return undefined;
	try {
		const url = new URL(text);
		return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
	} catch {
		return undefined;
	}
}

const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A bare company domain such as "ramp.com"; a job board link like "jobs.lever.co/palantir" is not one. */
export function domain(value: unknown): string | undefined {
	const text = str(value, 300)
		?.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/\/$/, "");
	return text && DOMAIN.test(text) ? text : undefined;
}

/** An ISO date-time from "2026-11-13", "2026-11-14 00:02:04" or a full timestamp; undefined when unreadable. */
export function isoDate(value: unknown): string | undefined {
	const text = str(value, 64);
	if (!text) return undefined;
	const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
		? `${text}T00:00:00Z`
		: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)
			? `${text.replace(" ", "T")}Z`
			: text;
	const time = Date.parse(normalized);
	return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** Provider text, which may be HTML, as capped plain text. Never rendered as HTML anywhere. */
export const plainText = (value: unknown) =>
	typeof value === "string" ? htmlToText(value).slice(0, MAX_JOB_DESCRIPTION_CHARS) : "";

export function strings(value: unknown, max = 100): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const item of value) {
		const text = str(item, 200);
		if (!text || seen.has(text.toLowerCase())) continue;
		seen.add(text.toLowerCase());
		result.push(text);
		if (result.length >= max) break;
	}
	return result;
}

/** Copies only the named fields that hold a value. */
export function pick(source: Unknown, keys: readonly string[]): Unknown {
	const result: Unknown = {};
	for (const key of keys) {
		const value = source[key];
		if (value !== null && value !== undefined && value !== "") result[key] = value;
	}
	return result;
}

let countryCodes: Map<string, string> | undefined;
const COUNTRY_ALIASES: Record<string, string> = {
	usa: "US",
	"united states of america": "US",
	uk: "GB",
	"great britain": "GB",
	england: "GB",
	scotland: "GB",
	wales: "GB",
	"czech republic": "CZ",
	"south korea": "KR",
	"republic of korea": "KR",
	russia: "RU",
	"viet nam": "VN",
	turkey: "TR",
	uae: "AE",
};

/** The ISO alpha-2 code for an English country name such as "United States"; undefined when unknown. */
export function countryCode(name: unknown): string | undefined {
	const text = str(name, 200)?.toLowerCase();
	if (!text) return undefined;
	if (/^[a-z]{2}$/.test(text) && SEARCH_REGION_CODES.includes(text.toUpperCase())) return text.toUpperCase();
	if (!countryCodes) {
		countryCodes = new Map(SEARCH_REGION_CODES.map((code) => [countryName(code, "en").toLowerCase(), code]));
		for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) countryCodes.set(alias, code);
	}
	return countryCodes.get(text);
}

export const englishCountryName = (code: string) => countryName(code, "en");

/** Seniority words from any provider on Rezumi's scale. */
export function seniority(value: unknown): JobSeniority | undefined {
	const text = str(value, 100)?.toLowerCase();
	if (!text) return undefined;
	if (/exec|\bvp\b|vice president|c[-_ ]?level|chief|head/.test(text)) return "executive";
	// JobsPipe's `director` level holds leads and managers too (its filter has no separate lead level).
	if (/director|lead|principal|staff|manager/.test(text)) return "lead";
	if (/senior|\bsr\b/.test(text)) return "senior";
	if (/mid|intermediate/.test(text)) return "mid";
	if (/junior|associate|\bjr\b/.test(text)) return "junior";
	if (/entry|intern|graduate|trainee|new grad/.test(text)) return "entry";
	return undefined;
}

/** A provider job read into Rezumi's shape, before validation. */
export type MappedJob = { listing: Unknown; raw: Unknown };

/** Keeps the listings that pass the schema, with their raw fields; counts the rest. */
export function validListings(items: MappedJob[]): { listings: ProviderListing[]; dropped: number } {
	const valid: ProviderListing[] = [];
	for (const item of items) {
		const parsed = jobListingDraftSchema.safeParse(item.listing);
		if (parsed.success) valid.push({ ...parsed.data, raw: item.raw });
	}
	return { listings: valid, dropped: items.length - valid.length };
}
