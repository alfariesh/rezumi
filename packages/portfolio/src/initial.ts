import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ProjectItem, ResumeData } from "@rezumi/schema/resume/data";
import { parseWritablePortfolioData, uniquePortfolioSlug } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import { PORTFOLIO_LIMITS, portfolioDataBytes, richTextLength } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl } from "@rezumi/schema/portfolio/links";
import { fallbackPortfolioAccent } from "@rezumi/schema/portfolio/themes";
import { generateId } from "@rezumi/utils/string";
import { sanitizePortfolioHtml } from "./rich-text";
import { escapeHtmlText, htmlToText, truncateText } from "./text";

const { text: max } = PORTFOLIO_LIMITS;
const WEB = new Set(["https:", "http:"]);

/** Resume HTML cleaned to the portfolio's subset; when its text runs past `limit`, the start of its text instead. */
function fitRichText(html: string, limit: number): string {
	const clean = sanitizePortfolioHtml(html);
	if (richTextLength(clean) <= limit) return clean;
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
	const link = isAllowedPortfolioUrl(url, WEB) ? url : null;
	const label = project.website.label.trim().slice(0, max.buttonLabel);
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
		title,
		summary: truncateText(htmlToText(description), max.workSummary),
		role: "",
		date: truncateText(project.period.trim(), max.workDate),
		tags: [],
		blocks,
		featured: false,
		hidden: false,
		...(link ? { primaryLink: { label, url: link } } : {}),
		...(/^[\w-]{1,64}$/.test(project.id) ? { fromResumeItemId: project.id } : {}),
	};
}

export type InitialPortfolioInput = {
	theme?: PortfolioTheme;
	/** The source resume's data, or null for a portfolio without one. */
	resume: ResumeData | null;
	/** For a portfolio without a resume: the basics the user typed. */
	basics?: { name?: string; headline?: string; location?: string };
};

/**
 * A new portfolio's first content (`02-teknis.md` 4.3). From a resume: About from its summary, works copied from its
 * projects, and accent and fonts following it. Without one: the basics given, a curated accent and the theme's fonts.
 * The career sections are not copied; they are read live from the resume.
 */
export function createInitialPortfolioData(input: InitialPortfolioInput): PortfolioData {
	const data = createDefaultPortfolioData(input.theme);

	if (!input.resume) {
		const basics = Object.fromEntries(
			Object.entries({
				name: input.basics?.name?.trim().slice(0, max.name),
				headline: input.basics?.headline?.trim().slice(0, max.headline),
				location: input.basics?.location?.trim().slice(0, max.location),
			}).filter(([, value]) => value),
		);
		return parseWritablePortfolioData({
			...data,
			basics,
			design: { ...data.design, accent: { source: "preset", id: fallbackPortfolioAccent }, fonts: { source: "theme" } },
		});
	}

	const taken = new Set<string>();
	const works = input.resume.sections.projects.items
		.filter((project) => !project.hidden)
		.map((project) => workFromResumeProject(project, taken))
		.filter((work): work is PortfolioWork => work !== null)
		.slice(0, PORTFOLIO_LIMITS.works);

	const initial = parseWritablePortfolioData({
		...data,
		design: { ...data.design, accent: { source: "resume" }, fonts: { source: "resume" } },
		about: { content: fitRichText(input.resume.summary.content, max.about) },
		works: { items: works },
	});
	// A resume with many long projects could outgrow the saved size; the last ones stay in the resume to add later.
	while (initial.works.items.length && portfolioDataBytes(initial) > PORTFOLIO_LIMITS.dataBytes)
		initial.works.items.pop();
	return initial;
}
