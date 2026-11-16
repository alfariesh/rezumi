import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { htmlToText } from "@rezumi/portfolio/text";
import { portfolioPageLocale, portfolioSourceResume } from "@rezumi/portfolio/view";
import { localeSchema } from "@rezumi/utils/locale";

/**
 * What AI may read from a resume: the work described, never how to reach the person. The name, email, phone, address,
 * website and profiles stay out, and contact details written inside a description are blanked. What the resume or the
 * portfolio hides stays out too, since it must not reach a public page through a draft.
 */

const EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/gu;
const URL_TEXT = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
/** Links that lead to the person themselves, written without https:// as often as with it. */
const PROFILE_LINK =
	/\b(?:linkedin\.com|github\.com|gitlab\.com|wa\.me|t\.me|instagram\.com|x\.com|twitter\.com|facebook\.com|tiktok\.com|behance\.net|dribbble\.com)\/[^\s"<>]+/gi;
/**
 * Phone-shaped: "+", a leading 0 or Indonesia's 62, then enough digits for a phone. A first digit other than those,
 * and "+" with dots, stay out, so amounts ("Rp 1.250.000.000", "+1.200.000") and periods ("2020-2024") are left alone.
 */
const PHONE =
	/(?<![\p{L}\p{Nd}.,])(?:\+\p{Nd}(?:[\s()-]{0,2}\p{Nd}){7,}|\(?[0٠۰]\p{Nd}(?:[\s().-]{0,2}\p{Nd}){7,}|62\p{Nd}{8,})(?![\p{L}\p{Nd}])/gu;

/** Text without contact details: an email, phone number or address reads as a blank. */
export const withoutContact = (text: string) =>
	text.replace(EMAIL, "[email]").replace(URL_TEXT, "[link]").replace(PROFILE_LINK, "[link]").replace(PHONE, "[phone]");

const CONTACTS = new RegExp([EMAIL.source, PROFILE_LINK.source, PHONE.source].join("|"), "giu");

/**
 * For text the person keeps, unlike a resume read for ideas: its contact details swapped for marks the model carries
 * over, so they never reach it, and a way to put them back.
 */
export function maskContacts(text: string) {
	const found: string[] = [];
	const masked = text.replace(CONTACTS, (contact) => {
		found.push(contact);
		return `{{${found.length}}}`;
	});
	return {
		masked,
		restore: (answer: string) => answer.replace(/\{\{(\d+)\}\}/g, (_, index: string) => found[Number(index) - 1] ?? ""),
	};
}

const clean = (html: string) => withoutContact(htmlToText(html));
const line = (...parts: string[]) => parts.map((part) => part.trim()).filter(Boolean);

type Item = { id: string; hidden: boolean };

/** A section's items a visitor could see on the page. */
function visibleItems<T extends Item>(
	data: PortfolioData,
	key: PortfolioSectionKey,
	section: { hidden: boolean; items: readonly T[] },
): readonly T[] {
	if (section.hidden || data.sections.hidden.includes(key)) return [];
	const hidden = new Set(data.sections.hiddenItems[key] ?? []);
	return section.items.filter((item) => !item.hidden && !hidden.has(item.id));
}

/** One job or project: where it comes from, and what the resume says about it. */
export type ResumeEntry = { source: string; text: string };

function experienceEntries(resume: ResumeData, data: PortfolioData): ResumeEntry[] {
	return visibleItems(data, "experience", resume.sections.experience).flatMap((job) => {
		const company = job.company.trim();
		const own = { source: line(job.position, company).join(" · "), text: clean(job.description) };
		const roles = (job.roles ?? []).map((role) => ({
			source: line(role.position, company).join(" · "),
			text: clean(role.description),
		}));
		return [own, ...roles];
	});
}

/** The projects a visitor could read about. Projects become works, so a hidden work hides its project. */
function visibleProjects(resume: ResumeData, data: PortfolioData) {
	if (resume.sections.projects.hidden || data.sections.hidden.includes("work")) return [];
	const hiddenWorks = new Set(
		data.works.items.flatMap((work) => (work.hidden && work.fromResumeItemId ? [work.fromResumeItemId] : [])),
	);
	return resume.sections.projects.items.filter((project) => !project.hidden && !hiddenWorks.has(project.id));
}

/** The jobs and projects with something written about them, for the search for numbers. */
export function resumeResultEntries(resume: ResumeData, data: PortfolioData): ResumeEntry[] {
	return [
		...experienceEntries(resume, data),
		...visibleProjects(resume, data).map((project) => ({
			source: project.name.trim(),
			text: clean(project.description),
		})),
	]
		.map((entry) => ({ ...entry, source: withoutContact(entry.source) }))
		.filter((entry) => entry.text);
}

const heading = (title: string, lines: string[]) => (lines.length ? `## ${title}\n\n${lines.join("\n\n")}` : "");

/** The resume as text for a draft, without anything that reaches the person. */
export function resumeForDraft(resume: ResumeData, data: PortfolioData): string {
	const summary = resume.summary.hidden ? "" : htmlToText(resume.summary.content);

	const jobs = visibleItems(data, "experience", resume.sections.experience).map((job) =>
		[
			line(job.position, job.company, job.period).join(" · "),
			htmlToText(job.description),
			...(job.roles ?? []).map((role) =>
				[line(role.position, role.period).join(" · "), htmlToText(role.description)].filter(Boolean).join("\n"),
			),
		]
			.filter(Boolean)
			.join("\n"),
	);
	const projects = visibleProjects(resume, data).map((project) =>
		[line(project.name, project.period).join(" · "), htmlToText(project.description)].filter(Boolean).join("\n"),
	);
	const education = visibleItems(data, "education", resume.sections.education).map((item) =>
		line(item.degree, item.area, item.school, item.period).join(" · "),
	);
	const skills = visibleItems(data, "skills", resume.sections.skills).map((item) =>
		line(item.name, item.keywords.join(", ")).join(": "),
	);
	const awards = visibleItems(data, "awards", resume.sections.awards).map((item) =>
		line(item.title, item.awarder, item.date).join(" · "),
	);
	const certifications = visibleItems(data, "certifications", resume.sections.certifications).map((item) =>
		line(item.title, item.issuer, item.date).join(" · "),
	);

	const text = [
		heading("Headline", line(resume.basics.headline)),
		heading("Summary", line(summary)),
		heading("Experience", jobs),
		heading("Projects", projects),
		heading("Education", education),
		heading("Skills", skills),
		heading("Awards", awards),
		heading("Certifications", certifications),
	]
		.filter(Boolean)
		.join("\n\n");
	return withoutContact(text);
}

const WORK_TEXT_LIMIT = 4000;

/** One work as text for a draft: what's on its card and in its Text blocks. */
export function workForDraft(work: PortfolioWork): string {
	const written = work.blocks.flatMap((block) => (block.type === "text" ? [htmlToText(block.html)] : [])).join(" ");
	const text = line(
		work.title && `Title: ${work.title}`,
		work.role && `Role: ${work.role}`,
		work.date && `Date: ${work.date}`,
		work.tags.length ? `Tags: ${work.tags.join(", ")}` : "",
		work.summary && `Current summary: ${work.summary}`,
		written && `Written so far: ${written.slice(0, WORK_TEXT_LIMIT)}`,
	).join("\n");
	return withoutContact(text);
}

/** A language by its English name ("Indonesian"), which models follow better than a code. */
export function languageName(locale: string): string {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale;
	} catch {
		return locale;
	}
}

/** The page's language by its English name ("Indonesian"). */
export function pageLanguage(data: PortfolioData, source: PortfolioSource | null): string {
	return languageName(portfolioPageLocale(data, portfolioSourceResume(source)));
}

/** A locale's language without its region: "id" for "id-ID". */
export const languageOf = (locale: string) => locale.split("-")[0] ?? locale;

/** What people also call a language in Indonesian, beyond its standard name. */
const INDONESIAN_ALIASES: Record<string, string[]> = { zh: ["mandarin", "cina"], ms: ["malaysia"] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every language a page can be in, by its lowercase name in `display` ("en" or "id"), to its language code. */
function languageNames(display: "en" | "id"): Map<string, string> {
	const names = new Map<string, string>();
	let displayNames: Intl.DisplayNames | null = null;
	try {
		displayNames = new Intl.DisplayNames([display], { type: "language" });
	} catch {
		// Without the runtime's language names, nothing is recognized and the model reads the note itself.
	}
	for (const locale of localeSchema.options) {
		const code = languageOf(locale);
		const name = displayNames?.of(code);
		if (name && name !== code) names.set(name.toLowerCase(), code);
		if (display === "id") for (const alias of INDONESIAN_ALIASES[code] ?? []) names.set(alias, code);
	}
	return names;
}

type LanguageAsk = { pattern: RegExp; names: Map<string, string> };

let languageAsks: LanguageAsk[] | null = null;

/**
 * How a note asks for the language to write in, in English ("write it in Indonesian") or in Indonesian ("tulis dalam
 * bahasa Indonesia"). Strict on purpose: a verb telling the writer what to do, not after "I" or "saya" (which describes
 * the person's own work, "I write docs in English"), and the language name ending the phrase, so "Indonesian startups"
 * or "bahasa Inggris setiap hari" don't count. What this misses, the model still reads in the note.
 */
function asks(): LanguageAsk[] {
	if (languageAsks) return languageAsks;
	const alternation = (names: Map<string, string>) =>
		[...names.keys()]
			.sort((a, b) => b.length - a.length)
			.map(escapeRegExp)
			.join("|");
	const english = languageNames("en");
	const indonesian = languageNames("id");
	languageAsks = [
		{
			names: english,
			pattern: new RegExp(
				String.raw`(?<!\b(?:i|we|they|he|she)\s+)\b(?:write|rewrite|draft|answer|reply|respond|use|make|keep|put|phrase)\b[^.!?\n]{0,60}?\bin\s+(?:the\s+)?(${alternation(english)})(?:\s+language)?(?=\s*(?:$|[.,;:!?)\n]|\b(?:only|please|instead)\b))`,
				"giu",
			),
		},
		{
			names: indonesian,
			pattern: new RegExp(
				String.raw`(?<!\b(?:saya|aku|kami|kita|dia|mereka)\s+)\b(?:tulis|tuliskan|tulislah|ditulis|buat|buatkan|buatlah|dibuat|gunakan|gunakanlah|pakai|pakailah|jawab|jawablah)\b[^.!?\n]{0,60}?\b(?:ber)?bahasa\s+(${alternation(indonesian)})(?=\s*(?:$|[.,;:!?)\n]|\b(?:saja|aja|ya|semua|semuanya|bukan|dong)\b))`,
				"giu",
			),
		},
	];
	return languageAsks;
}

const NEGATION = /\b(?:not|don['’]?t|never|jangan|bukan|tidak|tak)\b/i;

/**
 * The language a person's note asks the draft to be written in, as a language code ("id"), or null when it asks for
 * none, says not to use one ("don't write in English"), or names more than one. The note is the person's own text, so
 * this choice is theirs to make; every other rule still holds.
 */
export function noteLanguage(note: string): string | null {
	const found = new Set<string>();
	for (const { pattern, names } of asks()) {
		for (const match of note.matchAll(pattern)) {
			const name = match[1];
			const code = name && names.get(name.toLowerCase());
			if (!code) continue;
			// The two words before the verb in its clause ("jangan tulis", "don't write"), and those up to the name
			// ("write it, not in").
			const lead = (
				note
					.slice(0, match.index)
					.split(/[.!?,;\n]/)
					.at(-1) ?? ""
			)
				.trim()
				.split(/\s+/)
				.slice(-2)
				.join(" ");
			const gap = match[0].slice(0, match[0].lastIndexOf(name));
			if (NEGATION.test(`${lead} ${gap}`)) continue;
			found.add(code);
		}
	}
	return found.size === 1 ? ([...found][0] ?? null) : null;
}
