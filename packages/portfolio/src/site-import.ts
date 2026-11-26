import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import type { WorkDraft } from "@rezumi/schema/profile/website-import";
import type { ProjectItem } from "@rezumi/schema/resume/data";
import { uniquePortfolioSlug } from "@rezumi/schema/portfolio/data";
import { parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { isResumeReferenceId, PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { generateId } from "@rezumi/utils/string";
import { cutText, escapeHtmlText, truncateText } from "./text";

/**
 * Turning a website import's work drafts (`.agents/docs/plans/impor-website/02-teknis.md` section 6) into Profile
 * projects and portfolio works. Pure: pictures arrive already copied to the portfolio's storage, by their address on
 * the site.
 */

const { text: max } = PORTFOLIO_LIMITS;

/** Lowercase letters and digits only, for comparing names that differ in case, punctuation or spacing. */
const plain = (text: string) =>
	text
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

/** An address without its scheme, `www.`, query or trailing slash, for comparing links. */
function plainUrl(value: string): string {
	try {
		const url = new URL(value);
		return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
	} catch {
		return value.trim().toLowerCase();
	}
}

/** The addresses a draft is known by: its page on the site, and the work's own link. */
const draftUrls = (draft: WorkDraft) =>
	new Set([draft.sourceUrl, ...(draft.primaryLink ? [draft.primaryLink.url] : [])].map(plainUrl));

/**
 * Whether a project names the same work as a draft: the same link, or the same name. A name is the same when one
 * starts the other at a word boundary ("Rekanesia" and "Rekanesia: one product, many brands"), as long as it's at
 * least four characters, so "App" doesn't claim every app.
 */
export function isSameWork(project: Pick<ProjectItem, "name" | "website">, draft: WorkDraft): boolean {
	const url = project.website.url.trim();
	if (url && draftUrls(draft).has(plainUrl(url))) return true;
	const name = plain(project.name);
	const title = plain(draft.title);
	if (!name || !title) return false;
	if (name === title) return true;
	const [short, long] = name.length < title.length ? [name, title] : [title, name];
	return short.length >= 4 && long.startsWith(`${short} `);
}

/** The draft as a Profile project: its name, period, one-paragraph summary, and its link (or its page on the site). */
export function projectFromDraft(draft: WorkDraft): ProjectItem {
	const link = draft.primaryLink ?? { url: draft.sourceUrl, label: "" };
	return {
		id: generateId(),
		hidden: false,
		name: draft.title,
		period: draft.date,
		website: { url: link.url, label: link.label, inlineLink: false },
		description: draft.summary ? `<p>${escapeHtmlText(draft.summary)}</p>` : "",
	};
}

/** The draft's story as rich text: one paragraph per blank-line-separated block of the page's text. */
export function storyHtml(text: string): string {
	const paragraphs = text
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
		.filter(Boolean);
	let html = "";
	let length = 0;
	for (const paragraph of paragraphs) {
		const room = max.blockText - length;
		if (room <= 1) break;
		const fitted = paragraph.length > room ? truncateText(paragraph, room) : paragraph;
		html += `<p>${escapeHtmlText(fitted)}</p>`;
		length += fitted.length;
	}
	return html;
}

/**
 * A result as the page wrote it ("40%", "-12%", "3x", "#1") as a metric the page can draw: percentages and
 * multipliers as numbers, anything else short enough as text. Null for what doesn't fit a metric.
 */
export function metricFromText(label: string, value: string): PortfolioMetric | null {
	const name = cutText(label.trim(), max.metricLabel);
	const written = value.trim().replace(/\s+/g, " ");
	if (!name || !written) return null;
	const base = { id: generateId(), label: name };
	const percent = /^([+\-−]?)\s*(\d+(?:[.,]\d+)?)\s*%$/.exec(written);
	if (percent) {
		const number = Number.parseFloat((percent[2] ?? "").replace(",", "."));
		const sign = percent[1] === "−" ? "-" : percent[1];
		return {
			...base,
			value: { kind: "number", number },
			format: "percent",
			...(sign ? { prefix: sign } : {}),
		};
	}
	const multiplier = /^(\d+(?:[.,]\d+)?)\s*[x×]$/i.exec(written);
	if (multiplier)
		return {
			...base,
			value: { kind: "number", number: Number.parseFloat((multiplier[1] ?? "").replace(",", ".")) },
			format: "multiplier",
		};
	if (written.length <= max.metricText) return { ...base, value: { kind: "text", text: written }, format: "plain" };
	return null;
}

function hostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** A video or embed block for an address the portfolio can play, or null. */
function mediaBlock(url: string): PortfolioWork["blocks"][number] | null {
	const video = parseVideoUrl(url);
	if (video?.provider === "youtube")
		return {
			id: generateId(),
			type: "video",
			provider: "youtube",
			videoId: video.videoId,
			thumbnailUrl: youtubeThumbnailUrl(video.videoId),
		};
	if (video?.provider === "vimeo")
		return {
			id: generateId(),
			type: "video",
			provider: "vimeo",
			videoId: video.videoId,
			...(video.hash ? { hash: video.hash } : {}),
		};
	const embed = parseEmbedUrl(url);
	return embed ? { id: generateId(), type: "embed", provider: embed.provider, ref: embed.ref } : null;
}

/**
 * A portfolio work from a draft, in reading order: the story, its results, its pictures, its videos and embeds, then
 * its other links. `pictures` holds the copies of the draft's pictures by their address on the site; a picture that
 * couldn't be copied is left out. The work takes a free address from `taken` and adds it there.
 */
export function workFromDraft(
	draft: WorkDraft,
	pictures: ReadonlyMap<string, PortfolioImage>,
	taken: Set<string>,
	fromProjectId?: string,
): PortfolioWork {
	const title = truncateText(draft.title.trim(), max.workTitle) || hostname(draft.sourceUrl);
	const slug = uniquePortfolioSlug(title, taken);
	taken.add(slug);

	const blocks: PortfolioWork["blocks"] = [];
	const story = storyHtml(draft.description);
	if (story) blocks.push({ id: generateId(), type: "text", html: story });

	const metrics = draft.metrics
		.map((metric) => metricFromText(metric.label, metric.value))
		.filter((metric) => metric !== null)
		.slice(0, PORTFOLIO_LIMITS.metricsPerBlock);
	if (metrics.length) blocks.push({ id: generateId(), type: "metrics", items: metrics });

	const cover = draft.cover ? pictures.get(draft.cover.url) : undefined;
	const gallery = draft.gallery
		.map((image) => pictures.get(image.url))
		.filter((image) => image !== undefined)
		.slice(0, PORTFOLIO_LIMITS.imagesPerBlock);
	if (gallery.length)
		blocks.push({
			id: generateId(),
			type: "images",
			images: gallery,
			layout: gallery.length === 1 ? "full" : "grid",
		});

	for (const url of draft.embeds) {
		const block = mediaBlock(url);
		if (block) blocks.push(block);
	}
	const primary =
		draft.primaryLink && isAllowedPortfolioUrl(draft.primaryLink.url, PORTFOLIO_WEB_PROTOCOLS)
			? draft.primaryLink
			: null;
	for (const link of draft.links) {
		if (!isAllowedPortfolioUrl(link.url, PORTFOLIO_WEB_PROTOCOLS)) continue;
		blocks.push({
			id: generateId(),
			type: "link",
			url: link.url,
			title: truncateText(link.label.trim() || hostname(link.url), max.linkTitle),
		});
	}

	return {
		id: generateId(),
		slug,
		previousSlugs: [],
		title,
		summary: truncateText(draft.summary.trim(), max.workSummary),
		role: truncateText(draft.role.trim(), max.workRole),
		date: truncateText(draft.date.trim(), max.workDate),
		tags: draft.tags
			.map((tag) => cutText(tag.trim(), max.tag))
			.filter(Boolean)
			.slice(0, PORTFOLIO_LIMITS.tagsPerWork),
		...(cover ? { cover } : {}),
		...(metrics[0] ? { highlightMetricId: metrics[0].id } : {}),
		...(primary ? { primaryLink: { label: cutText(primary.label.trim(), max.buttonLabel), url: primary.url } } : {}),
		blocks: blocks.slice(0, PORTFOLIO_LIMITS.blocksPerWork),
		featured: false,
		hidden: false,
		...(fromProjectId && isResumeReferenceId(fromProjectId) ? { fromResumeItemId: fromProjectId } : {}),
	};
}

/**
 * Whether a portfolio already has a draft's work: one copied from the same project, or one with the same title. Asked
 * before importing, so importing a site twice adds nothing twice.
 */
export function hasWork(
	works: readonly Pick<PortfolioWork, "title" | "fromResumeItemId">[],
	draft: WorkDraft,
	projectId?: string,
): boolean {
	const title = plain(draft.title);
	return works.some(
		(work) =>
			(projectId !== undefined && work.fromResumeItemId === projectId) || (title !== "" && plain(work.title) === title),
	);
}
