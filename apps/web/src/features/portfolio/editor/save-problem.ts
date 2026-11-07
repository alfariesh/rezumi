import type { PortfolioDataPath, PortfolioRetryReason, PortfolioSaveProblem } from "./save-failure";
import type { PortfolioViewMessages } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { t } from "@lingui/core/macro";
import { portfolioErrorMessage, portfolioRefusalMessage, portfolioTooLargeMessage } from "../errors";
import { sectionLabel } from "./sections";

// A save problem in the user's words, and the place in the editor it concerns (`01-desain.md` 7: errors are shown
// where they are; the save status names the place and opens it).

type PortfolioEditorTab = "write" | "design" | "share";

/** What "Show me" opens: the tab, the section in Content's list, and the work, when the place is in one. */
export type PortfolioReveal = { tab: PortfolioEditorTab; section?: PortfolioSectionKey; workId?: string };

export type PortfolioProblemPlace = {
	/** The place in the editor's words: "Intro → Greeting", "Work → Kopi Senja". */
	label: string;
	reveal: PortfolioReveal;
};

export type PortfolioPlaceContext = {
	data: PortfolioData;
	resume: ResumeData | null;
	/** The page's own words, for default section titles, as the section list shows them. */
	messages: PortfolioViewMessages;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The path to the first value in `value` equal to `target` (a file's key in the data), or null when there's none. */
export function pathOfValue(value: unknown, target: string, path: (string | number)[] = []): PortfolioDataPath | null {
	if (value === target) return path;
	if (Array.isArray(value)) {
		for (const [index, entry] of value.entries()) {
			const found = pathOfValue(entry, target, [...path, index]);
			if (found) return found;
		}
	} else if (isRecord(value)) {
		for (const [key, entry] of Object.entries(value)) {
			const found = pathOfValue(entry, target, [...path, key]);
			if (found) return found;
		}
	}
	return null;
}

const joined = (...parts: string[]) => parts.join(" → ");

/** The intro's fields, by their key under `basics` or `hero`. */
function introField(key: unknown): string | null {
	switch (key) {
		case "name":
			return t`Name`;
		case "headline":
			return t`Headline`;
		case "location":
			return t`Location`;
		case "picture":
		case "showPicture":
			return t`Photo`;
		case "greeting":
			return t`Greeting`;
		case "highlights":
			return t`Achievement numbers`;
		case "buttons":
			return t`Buttons`;
		default:
			return null;
	}
}

/** The place in the editor a path into the data leads to, in words and as what to open; null when it's nowhere. */
export function problemPlace(path: PortfolioDataPath, context: PortfolioPlaceContext): PortfolioProblemPlace | null {
	const { data, resume, messages } = context;
	const [head, second, third] = path;
	const section = (key: PortfolioSectionKey, detail?: string, workId?: string): PortfolioProblemPlace => {
		const name = sectionLabel(key, data, resume, messages);
		return {
			label: detail ? joined(name, detail) : name,
			reveal: { tab: "write", section: key, ...(workId ? { workId } : {}) },
		};
	};
	// A function declaration, not a generic arrow: the build's Lingui macro step parses `.ts` files as TSX, where
	// `<T>(…) =>` reads as a JSX tag.
	function itemAt<T>(list: readonly T[], at: unknown): T | undefined {
		return typeof at === "number" ? list[at] : undefined;
	}

	switch (head) {
		case "basics":
		case "hero": {
			if (head === "hero" && second === "effect")
				return { label: joined(t`Intro`, t`Intro effect`), reveal: { tab: "design" } };
			if (head === "hero" && second === "background")
				return { label: joined(t`Intro`, t`Intro background`), reveal: { tab: "design" } };
			const field = introField(second);
			return { label: field ? joined(t`Intro`, field) : t`Intro`, reveal: { tab: "write" } };
		}
		case "about":
			return section("about");
		case "works": {
			const work = second === "items" ? itemAt(data.works.items, third) : undefined;
			return work ? section("work", work.title.trim() || t`Untitled work`, work.id) : section("work");
		}
		case "services": {
			const service = second === "items" ? itemAt(data.services.items, third) : undefined;
			return section("services", service ? service.title.trim() || t`Untitled service` : undefined);
		}
		case "testimonials": {
			const testimonial = second === "items" ? itemAt(data.testimonials.items, third) : undefined;
			return section("testimonials", testimonial ? testimonial.name.trim() || t`Untitled testimonial` : undefined);
		}
		case "clients": {
			const client = second === "items" ? itemAt(data.clients.items, third) : undefined;
			return section("clients", client ? client.name.trim() || t`Untitled client` : undefined);
		}
		case "custom": {
			const custom = itemAt(data.custom, second);
			return custom ? section(`custom:${custom.id}`) : { label: t`Sections`, reveal: { tab: "write" } };
		}
		case "contact":
			return section("contact");
		case "location":
			return section("contact", t`Location`);
		case "sections":
			return { label: t`Sections`, reveal: { tab: "write" } };
		case "theme":
		case "design":
			return { label: t`Design`, reveal: { tab: "design" } };
		case "seo":
			return { label: t`Search engines`, reveal: { tab: "share" } };
		case "locale":
			return { label: t`Page language`, reveal: { tab: "share" } };
		default:
			return null;
	}
}

export type PortfolioProblemDescription = {
	/** What happened and what to do, in a sentence or two. */
	message: string;
	/** Where it is, when the problem has one place. */
	place: PortfolioProblemPlace | null;
};

/** A save problem in the user's words, and where it is. */
export function describeSaveProblem(
	problem: PortfolioSaveProblem,
	context: PortfolioPlaceContext,
): PortfolioProblemDescription {
	switch (problem.kind) {
		case "field": {
			const place = problemPlace(problem.path, context);
			const where = place?.label;
			return {
				message: where
					? t`Something in ${where} can't be saved as it is. Change or remove it, or undo your last change.`
					: t`Something in your portfolio can't be saved as it is. Undo your last change, or contact support if this keeps happening.`,
				place,
			};
		}
		case "too-large":
			return { message: portfolioTooLargeMessage(problem.bytes, problem.max), place: null };
		case "file-missing": {
			const path = problem.key ? pathOfValue(context.data, problem.key) : null;
			return {
				message: portfolioRefusalMessage("PORTFOLIO_FILE_NOT_FOUND") ?? "",
				place: path ? problemPlace(path, context) : null,
			};
		}
		case "refused":
			return {
				message: portfolioErrorMessage(problem.error, {
					fallback: t`Your portfolio couldn't be saved. Undo your last change, or contact support if this keeps happening.`,
				}),
				place: null,
			};
		case "gone":
			return { message: portfolioRefusalMessage(problem.code) ?? "", place: null };
	}
}

/** Why saving is being tried again, in the user's words. */
export function describeRetry(reason: PortfolioRetryReason): string {
	switch (reason) {
		case "offline":
			return t`The connection dropped. Your changes are kept here, and saving tries again by itself.`;
		case "busy":
			return t`Too many saves in a short time. Saving tries again in a moment.`;
		case "server":
			return t`The server couldn't save your changes. Saving tries again by itself.`;
		case "signed-out":
			return t`You're signed out. Sign in again in another tab, and saving continues.`;
	}
}
