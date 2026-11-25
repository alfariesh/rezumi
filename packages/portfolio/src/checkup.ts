import type { PortfolioView, PortfolioViewWork } from "./view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";

/**
 * What a page check can find. `important` findings mean something the person made doesn't reach visitors, or visitors
 * can't act on the page; `suggestion` findings make a page stronger and are fine to leave.
 */
export const PORTFOLIO_CHECK_IDS = [
	"name",
	"work-untitled",
	"whatsapp-number",
	"contact",
	"headline",
	"intro-text",
	"photo",
	"works",
	"work-cover",
	"work-summary",
	"work-empty",
	"image-alt",
] as const;
export type PortfolioCheckId = (typeof PORTFOLIO_CHECK_IDS)[number];

export type PortfolioCheckFinding = {
	id: PortfolioCheckId;
	level: "important" | "suggestion";
	/** The works it is about, in page order; empty for findings about the page as a whole. */
	workIds: string[];
	/** How many things to fix: works, or pictures for `image-alt`. 1 for findings about the page as a whole. */
	count: number;
};

type CheckupInput = {
	data: PortfolioData;
	/** The page built from `data` (`buildPortfolioView`), so the check judges what visitors get, resume values included. */
	view: PortfolioView;
};

const CONTACT_BUTTONS: ReadonlySet<string> = new Set(["contact", "whatsapp", "email", "profile"]);

/** Pictures of a work that say nothing to screen readers and search engines: its cover and its Images blocks'. */
function picturesWithoutAlt(work: PortfolioViewWork): number {
	const pictures = [
		...(work.cover ? [work.cover] : []),
		...work.blocks.flatMap((block) => (block.type === "images" ? block.images : [])),
	];
	return pictures.filter((picture) => picture.alt.trim() === "").length;
}

/**
 * Reads a portfolio the way a visitor meets it and lists what is missing, most important first. It never changes
 * anything and never blocks publishing: the editor shows the list with a way to each spot.
 *
 * Choices the person made on purpose aren't findings: a hidden Work section, "No photo", a photo switched off.
 */
export function checkPortfolio({ data, view }: CheckupInput): PortfolioCheckFinding[] {
	const findings: PortfolioCheckFinding[] = [];
	const page = (id: PortfolioCheckId, level: PortfolioCheckFinding["level"]) =>
		findings.push({ id, level, workIds: [], count: 1 });
	const works = (id: PortfolioCheckId, level: PortfolioCheckFinding["level"], ids: string[], count = ids.length) => {
		if (ids.length > 0) findings.push({ id, level, workIds: ids, count });
	};

	if (view.basics.name.trim() === "") page("name", "important");

	const workHidden = data.sections.hidden.includes("work");
	const listed = workHidden ? [] : (view.sections.find((section) => section.kind === "work")?.works ?? []);

	if (!workHidden)
		works(
			"work-untitled",
			"important",
			data.works.items.filter((work) => !work.hidden && work.title.trim() === "").map((work) => work.id),
		);

	if (data.contact.whatsapp.show && data.contact.whatsapp.number === "") page("whatsapp-number", "important");

	const hasContactSection = view.sections.some((section) => section.kind === "contact");
	const hasContactButton = view.hero.buttons.some((button) => button.kind && CONTACT_BUTTONS.has(button.kind));
	if (!hasContactSection && !hasContactButton) page("contact", "important");

	if (view.basics.headline.trim() === "") page("headline", "suggestion");

	const hasAbout = view.sections.some((section) => section.kind === "about");
	if (view.hero.greeting.trim() === "" && !hasAbout) page("intro-text", "suggestion");

	// "No photo" (null) and a switched-off photo are choices; a photo that was wanted but isn't there is a gap.
	if (data.hero.showPicture && data.basics.picture !== null && view.hero.picture === null) page("photo", "suggestion");

	if (!workHidden) {
		if (listed.length === 0 && !findings.some((finding) => finding.id === "work-untitled")) page("works", "suggestion");
		works(
			"work-cover",
			"suggestion",
			listed.filter((work) => !work.cover).map((work) => work.id),
		);
		works(
			"work-summary",
			"suggestion",
			listed.filter((work) => work.summary.trim() === "").map((work) => work.id),
		);
		works(
			"work-empty",
			"suggestion",
			listed.filter((work) => work.blocks.length === 0).map((work) => work.id),
		);
		const silent = listed.filter((work) => picturesWithoutAlt(work) > 0);
		works(
			"image-alt",
			"suggestion",
			silent.map((work) => work.id),
			silent.reduce((sum, work) => sum + picturesWithoutAlt(work), 0),
		);
	}

	// Stable: important first, each group in the order above.
	return [
		...findings.filter((finding) => finding.level === "important"),
		...findings.filter((finding) => finding.level === "suggestion"),
	];
}
