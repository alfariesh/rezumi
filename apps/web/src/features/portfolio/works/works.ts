import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { PORTFOLIO_SLUG_PATTERN, uniquePortfolioSlug } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { newImagesBlock } from "../blocks/blocks";

function slugsExcept(data: Pick<PortfolioData, "works">, workId?: string): Set<string> {
	return new Set(data.works.items.filter((work) => work.id !== workId).map((work) => work.slug));
}

/**
 * How many more works the portfolio can hold: `limit` is the account's (`portfolio.get` → `limits.works`, which its
 * plan sets), else the technical limit.
 */
export function workRoom(data: Pick<PortfolioData, "works">, limit: number = PORTFOLIO_LIMITS.works): number {
	return Math.max(0, Math.min(limit, PORTFOLIO_LIMITS.works) - data.works.items.length);
}

/** An empty work with its own address. */
export function newWork(data: Pick<PortfolioData, "works">, title = ""): PortfolioWork {
	return {
		id: generateId(),
		slug: uniquePortfolioSlug(title, slugsExcept(data)),
		previousSlugs: [],
		title,
		summary: "",
		role: "",
		date: "",
		tags: [],
		blocks: [],
		featured: false,
		hidden: false,
	};
}

/** Why an address typed for a work can't be used, or null when it can. */
export function workSlugProblem(
	data: Pick<PortfolioData, "works">,
	workId: string,
	slug: string,
): "pattern" | "taken" | null {
	if (!slug || slug.length > PORTFOLIO_LIMITS.text.slug || !PORTFOLIO_SLUG_PATTERN.test(slug)) return "pattern";
	return slugsExcept(data, workId).has(slug) ? "taken" : null;
}

/** Old addresses as stored: newest first, each once, at most the limit, none that a work now uses as its address. */
export function cleanSlugHistory(history: readonly string[], active: ReadonlySet<string>): string[] {
	return [...new Set(history)].filter((slug) => !active.has(slug)).slice(0, PORTFOLIO_LIMITS.previousSlugs);
}

/**
 * Gives a work a new address (Phase 13 3.1). The old one goes to the front of `previousSlugs`, so links already
 * shared forward to the new one, but only when it was saved as this work's address: `saved` is the data the server
 * last took (`lastSavedData`), so the letters of a title being typed never pile up as old addresses. Without `saved`
 * (unknown) the old address is kept. No work keeps an old address another work now uses.
 */
export function changeWorkSlug(
	data: Pick<PortfolioData, "works">,
	work: PortfolioWork,
	slug: string,
	saved?: Pick<PortfolioData, "works"> | null,
): void {
	const old = work.slug;
	if (old === slug) return;
	const savedWork = saved?.works.items.find((entry) => entry.id === work.id);
	const wasSaved =
		saved === undefined || (savedWork ? savedWork.slug === old || savedWork.previousSlugs.includes(old) : false);
	work.slug = slug;
	const active = new Set(data.works.items.map((entry) => (entry.id === work.id ? slug : entry.slug)));
	work.previousSlugs = cleanSlugHistory(wasSaved ? [old, ...work.previousSlugs] : work.previousSlugs, active);
	for (const other of data.works.items)
		if (other.id !== work.id && other.previousSlugs.includes(slug))
			other.previousSlugs = other.previousSlugs.filter((entry) => entry !== slug);
}

/**
 * Changes a work's title. Its address follows the title while it still is the one the old title makes, as it is for
 * works made in the editor, imported from the resume, or made from pictures or a link. An address that differs (a
 * work whose address another work's took first, one typed by hand, data written outside the editor) stays as it is.
 */
export function retitleWork(
	data: Pick<PortfolioData, "works">,
	work: PortfolioWork,
	title: string,
	saved?: Pick<PortfolioData, "works"> | null,
): void {
	const others = slugsExcept(data, work.id);
	const automatic = work.slug === uniquePortfolioSlug(work.title, others);
	work.title = title;
	if (automatic) changeWorkSlug(data, work, uniquePortfolioSlug(title, others), saved);
}

/** A title from a file name, at most `max` characters: "kopi-senja_final.jpg" → "kopi senja final". */
export function titleFromFileName(name: string, max: number = PORTFOLIO_LIMITS.text.workTitle): string {
	return name
		.replace(/\.[^.]+$/, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, max);
}

/**
 * Works from uploaded pictures: one work holding them all in a Pictures block (its cover the first picture), or one
 * work per picture, titled after its file. Limited by the room the portfolio has.
 */
export function worksFromImages(
	data: Pick<PortfolioData, "works">,
	images: readonly { image: PortfolioImage; fileName: string }[],
	mode: "one" | "each",
	title: string,
	limit?: number,
): PortfolioWork[] {
	const room = workRoom(data, limit);
	if (!images.length || !room) return [];
	const taken = slugsExcept(data);
	const make = (workTitle: string, pictures: readonly PortfolioImage[]): PortfolioWork => {
		const slug = uniquePortfolioSlug(workTitle, taken);
		taken.add(slug);
		const [first] = pictures;
		return {
			id: generateId(),
			slug,
			previousSlugs: [],
			title: workTitle,
			summary: "",
			role: "",
			date: "",
			tags: [],
			...(first ? { cover: { ...first, alt: first.alt || workTitle } } : {}),
			blocks: pictures.length > 1 || mode === "one" ? [newImagesBlock(pictures)] : [],
			featured: false,
			hidden: false,
		};
	};
	if (mode === "one") {
		// A Pictures block holds at most 12; more make further works of the same title.
		const groups: PortfolioImage[][] = [];
		for (let index = 0; index < images.length; index += PORTFOLIO_LIMITS.imagesPerBlock)
			groups.push(images.slice(index, index + PORTFOLIO_LIMITS.imagesPerBlock).map((entry) => entry.image));
		return groups.slice(0, room).map((group) => make(title, group));
	}
	return images
		.slice(0, room)
		.map((entry) => make(entry.image.alt || titleFromFileName(entry.fileName), [entry.image]));
}

export type ImportableProject = { id: string; name: string; period: string; imported: boolean };

/** The source resume's projects, marking the ones already brought in as works. Hidden projects aren't offered. */
export function resumeProjects(resume: ResumeData | null, works: readonly PortfolioWork[]): ImportableProject[] {
	if (!resume) return [];
	const imported = new Set(works.flatMap((work) => (work.fromResumeItemId ? [work.fromResumeItemId] : [])));
	return resume.sections.projects.items
		.filter((item) => !item.hidden && item.name.trim())
		.map((item) => ({
			id: item.id,
			name: item.name.trim(),
			period: item.period.trim(),
			imported: imported.has(item.id),
		}));
}
