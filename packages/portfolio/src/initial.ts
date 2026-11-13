import type { PortfolioSource } from "./source";
import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ProjectItem } from "@rezumi/schema/resume/data";
import { parseWritablePortfolioData, uniquePortfolioSlug } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import {
	fitsRichText,
	isResumeReferenceId,
	PORTFOLIO_LIMITS,
	portfolioDataBytes,
} from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { fallbackPortfolioAccent } from "@rezumi/schema/portfolio/themes";
import { generateId } from "@rezumi/utils/string";
import { sanitizePortfolioHtml } from "./rich-text";
import { portfolioSourceResume } from "./source";
import { cutText, escapeHtmlText, htmlToText, truncateText } from "./text";

const { text: max } = PORTFOLIO_LIMITS;

/**
 * Resume HTML cleaned to the portfolio's subset. When it doesn't fit the field (its text runs past `limit`, or its
 * markup past what the field holds), the start of its text instead.
 */
function fitRichText(html: string, limit: number): string {
	const clean = sanitizePortfolioHtml(html);
	if (fitsRichText(clean, limit)) return clean;
	return `<p>${escapeHtmlText(truncateText(htmlToText(clean), limit))}</p>`;
}

function hostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** A work copied from a resume project: its card from the name, period and description, and Text and Link blocks. */
export function workFromResumeProject(project: ProjectItem, taken: Set<string>): PortfolioWork | null {
	const description = fitRichText(project.description, max.blockText);
	if (!project.name.trim() && !htmlToText(description)) return null;
	const url = project.website.url.trim();
	const link = isAllowedPortfolioUrl(url, PORTFOLIO_WEB_PROTOCOLS) ? url : null;
	const label = cutText(project.website.label.trim(), max.buttonLabel);
	const title = truncateText(project.name.trim(), max.workTitle);
	const slug = uniquePortfolioSlug(title, taken);
	taken.add(slug);

	const blocks: PortfolioWork["blocks"] = [];
	if (htmlToText(description)) blocks.push({ id: generateId(), type: "text", html: description });
	if (link)
		blocks.push({
			id: generateId(),
			type: "link",
			url: link,
			title: truncateText(project.website.label.trim() || hostname(link), max.linkTitle),
		});

	return {
		id: generateId(),
		slug,
		previousSlugs: [],
		title,
		summary: truncateText(htmlToText(description), max.workSummary),
		role: "",
		date: truncateText(project.period.trim(), max.workDate),
		tags: [],
		blocks,
		featured: false,
		hidden: false,
		...(link ? { primaryLink: { label, url: link } } : {}),
		...(isResumeReferenceId(project.id) ? { fromResumeItemId: project.id } : {}),
	};
}

export type InitialPortfolioInput = {
	theme?: PortfolioTheme;
	/** Where its content comes from (`PortfolioSource`): a resume, the Profile, or null for neither. */
	resume: PortfolioSource | null;
	/** Basics the user typed, for a portfolio whose source isn't a resume. */
	basics?: { name?: string; headline?: string; location?: string };
};

/**
 * A new portfolio's first content (`02-teknis.md` 4.3). From a source: About from its summary and works copied from
 * its projects; what it hides (its summary, its Projects section, a project) isn't copied. A resume also lends its
 * accent and fonts; the Profile and no source take a curated accent and the theme's fonts, and the basics given. The
 * career sections are not copied; they are read live from the source.
 */
export function createInitialPortfolioData(input: InitialPortfolioInput): PortfolioData {
	const data = createDefaultPortfolioData(input.theme);
	const source = input.resume;
	const fromResume = portfolioSourceResume(source) !== null;

	const typed = fromResume
		? {}
		: Object.fromEntries(
				Object.entries({
					name: cutText(input.basics?.name?.trim() ?? "", max.name),
					headline: cutText(input.basics?.headline?.trim() ?? "", max.headline),
					location: cutText(input.basics?.location?.trim() ?? "", max.location),
				}).filter(([, value]) => value),
			);
	const design = fromResume
		? { ...data.design, accent: { source: "resume" as const }, fonts: { source: "resume" as const } }
		: {
				...data.design,
				accent: { source: "preset" as const, id: fallbackPortfolioAccent },
				fonts: { source: "theme" as const },
			};

	if (!source) return parseWritablePortfolioData({ ...data, basics: typed, design });

	const { summary, sections } = source.data;
	const taken = new Set<string>();
	const works = (sections.projects.hidden ? [] : sections.projects.items)
		.filter((project) => !project.hidden)
		.map((project) => workFromResumeProject(project, taken))
		.filter((work): work is PortfolioWork => work !== null)
		.slice(0, PORTFOLIO_LIMITS.works);

	const initial = parseWritablePortfolioData({
		...data,
		basics: typed,
		design,
		about: { content: summary.hidden ? "" : fitRichText(summary.content, max.about) },
		works: { items: works },
	});
	// A source with many long projects could outgrow the saved size; the last ones stay in it to add later.
	while (initial.works.items.length && portfolioDataBytes(initial) > PORTFOLIO_LIMITS.dataBytes)
		initial.works.items.pop();
	return initial;
}
