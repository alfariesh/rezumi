/**
 * Which job board a page belongs to, the posting's canonical address and its job key: the identity the browser
 * extension uses to mark a posting as saved and the server uses to keep one posting from being saved twice.
 *
 * Pure URL work (no DOM, no network, no Zod), so it runs in the extension's content script, the extension's service
 * worker and the server alike.
 *
 * The board patterns come from public knowledge of each site's addresses (2026-11). Phase 03 of the extension plan
 * re-checks them against real pages (.agents/docs/plans/plugin-browser/02-teknis.md §7.4).
 */

export const JOB_SITES = ["linkedin", "indeed", "jobstreet", "glints"] as const;

/** A job board with its own reader in the extension. */
export type JobSite = (typeof JOB_SITES)[number];

/** Query parameters that only track where a visit came from; never part of a posting's identity. */
const TRACKING_PARAMS = new Set([
	"ref",
	"refid",
	"referer",
	"referrer",
	"source",
	"src",
	"trk",
	"trkinfo",
	"trackingid",
	"tracking_id",
	"fbclid",
	"gclid",
	"dclid",
	"msclkid",
	"yclid",
	"twclid",
	"li_fat_id",
	"mc_cid",
	"mc_eid",
	"_hsenc",
	"_hsmi",
	"igshid",
	"si",
]);

const isTrackingParam = (name: string) => {
	const lower = name.toLowerCase();
	return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
};

function toUrl(input: string | URL): URL | null {
	try {
		const url = new URL(input);
		return url.protocol === "https:" || url.protocol === "http:" ? url : null;
	} catch {
		return null;
	}
}

const onDomain = (hostname: string, domain: string) => hostname === domain || hostname.endsWith(`.${domain}`);

/** The job board an address belongs to, by host alone; null for every other site. */
export function detectSite(input: string | URL): JobSite | null {
	const url = toUrl(input);
	if (!url) return null;
	const host = url.hostname.toLowerCase();
	if (onDomain(host, "linkedin.com")) return "linkedin";
	if (onDomain(host, "indeed.com")) return "indeed";
	if (onDomain(host, "jobstreet.com")) return "jobstreet";
	if (onDomain(host, "glints.com")) return "glints";
	return null;
}

type BoardPosting = { site: JobSite; id: string; canonicalUrl: string };

const LINKEDIN_ID = /^\d{6,}$/;
const INDEED_ID = /^[\da-f]{16}$/i;
const JOBSTREET_ID = /^\d{5,}$/;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * LinkedIn: `/jobs/view/<id>/` (also `/jobs/view/<title>-at-<company>-<id>/`), or a search or collection page with the
 * posting picked in its side pane (`?currentJobId=<id>`). Every country host (`id.linkedin.com`) shares one id space.
 */
function linkedinPosting(url: URL): BoardPosting | null {
	const view = /^\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/.exec(url.pathname)?.[1];
	const picked = url.pathname.startsWith("/jobs") ? url.searchParams.get("currentJobId") : null;
	const id = view ?? (picked && LINKEDIN_ID.test(picked) ? picked : null);
	return id ? { site: "linkedin", id, canonicalUrl: `https://www.linkedin.com/jobs/view/${id}/` } : null;
}

/** Indeed: `/viewjob?jk=<id>` (also under `/m/`), or a search page with a posting open beside it (`?vjk=<id>`). */
function indeedPosting(url: URL): BoardPosting | null {
	const jk = /^\/(?:m\/)?viewjob\/?$/.test(url.pathname) ? url.searchParams.get("jk") : null;
	const id = jk ?? url.searchParams.get("vjk");
	if (!id || !INDEED_ID.test(id)) return null;
	const key = id.toLowerCase();
	return { site: "indeed", id: key, canonicalUrl: `https://${url.hostname.toLowerCase()}/viewjob?jk=${key}` };
}

/** JobStreet: `/<lang>/job/<id>` or `/job/<id>`, or a search page with a posting open beside it (`?jobId=<id>`). */
function jobstreetPosting(url: URL): BoardPosting | null {
	const path = /^\/(?:[a-z]{2}\/)?job\/(\d{5,})\/?$/i.exec(url.pathname)?.[1];
	const picked = url.searchParams.get("jobId");
	const id = path ?? (picked && JOBSTREET_ID.test(picked) ? picked : null);
	return id ? { site: "jobstreet", id, canonicalUrl: `https://${url.hostname.toLowerCase()}/job/${id}` } : null;
}

/** Glints: `/<country>[/<lang>]/opportunities/jobs/<slug>/<uuid>`; the address without its query is canonical. */
function glintsPosting(url: URL): BoardPosting | null {
	const match = /^\/(?:[a-z]{2}\/){0,2}opportunities\/jobs\/[^/]+\/([^/]+)\/?$/i.exec(url.pathname);
	const id = match?.[1];
	if (!id || !UUID.test(id)) return null;
	const path = url.pathname.replace(/\/$/, "");
	return { site: "glints", id: id.toLowerCase(), canonicalUrl: `https://glints.com${path}` };
}

const BOARD_READERS: Record<JobSite, (url: URL) => BoardPosting | null> = {
	linkedin: linkedinPosting,
	indeed: indeedPosting,
	jobstreet: jobstreetPosting,
	glints: glintsPosting,
};

function boardPosting(url: URL): BoardPosting | null {
	const site = detectSite(url);
	return site ? BOARD_READERS[site](url) : null;
}

/**
 * Any other site's address as a posting identity: lower-case host without `www.`, the path without a trailing slash,
 * and the query without tracking parameters, sorted (`?gh_jid=…` names the posting on many career pages).
 */
function genericParts(url: URL) {
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	const path = url.pathname.replace(/\/+$/, "");
	const params = [...url.searchParams].filter(([name]) => !isTrackingParam(name));
	params.sort(([a, aValue], [b, bValue]) => (a === b ? aValue.localeCompare(bValue) : a.localeCompare(b)));
	const query = new URLSearchParams(params).toString();
	return { host, path, query: query ? `?${query}` : "" };
}

/**
 * The address to save for a posting: the board's own permanent posting address on the four boards, any other site's
 * address without tracking parameters and fragment. Null for a board page with no posting open, or a non-http(s)
 * address.
 */
export function canonicalJobUrl(input: string | URL): string | null {
	const url = toUrl(input);
	if (!url) return null;
	if (detectSite(url)) return boardPosting(url)?.canonicalUrl ?? null;
	const clean = new URL(url);
	clean.hash = "";
	const names = new Set(clean.searchParams.keys());
	for (const name of names) if (isTrackingParam(name)) clean.searchParams.delete(name);
	return clean.toString();
}

/**
 * The posting's identity: `linkedin:<id>`, `indeed:<jk>`, `jobstreet:<id>`, `glints:<uuid>`, or `url:<host><path>[?query]`
 * for any other site. Null for a board page with no posting open, or a non-http(s) address.
 */
export function jobKey(input: string | URL): string | null {
	const url = toUrl(input);
	if (!url) return null;
	if (detectSite(url)) {
		const posting = boardPosting(url);
		return posting ? `${posting.site}:${posting.id}` : null;
	}
	const { host, path, query } = genericParts(url);
	return `url:${host}${path}${query}`;
}
