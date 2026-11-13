import type { SourceNote } from "@rezumi/schema/profile/sources";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { ResumeDates } from "@rezumi/schema/resume/dates";
import { getNetworkIcon } from "@rezumi/resume/icons";
import { linkedInProfileUrl } from "@rezumi/schema/profile/sources";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { formatResumeDates, readLegacyDates } from "@rezumi/schema/resume/dates";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { generateId } from "@rezumi/utils/string";
import { formatDate, toRangeDates, toSingleDates } from "./date";
import { rethrowAsImportError } from "./error";
import { toHtml } from "./html";
import { parseLevel } from "./level";
import { ZipEntryTooLargeError, unzipEntries } from "./zip";

const LINKEDIN_CSVS = new Set([
	"profile.csv",
	"positions.csv",
	"education.csv",
	"skills.csv",
	"languages.csv",
	"certifications.csv",
]);

// Real LinkedIn CSVs are kilobytes; the cap keeps a crafted archive from exhausting the tab's memory.
const MAX_CSV_BYTES = 5 * 1024 * 1024;

// LinkedIn's five fixed proficiency options, mapped onto the 0-5 level scale.
const LANGUAGE_LEVELS: Record<string, number> = {
	"native or bilingual": 5,
	"full professional": 4,
	"professional working": 3,
	"limited working": 2,
	elementary: 1,
};

// Own keys only: a proficiency like "constructor" must not resolve to an Object member.
const knownLanguageLevel = (name: string) => (Object.hasOwn(LANGUAGE_LEVELS, name) ? LANGUAGE_LEVELS[name] : undefined);

const MONTHS: Record<string, string> = {
	jan: "01",
	feb: "02",
	mar: "03",
	apr: "04",
	may: "05",
	jun: "06",
	jul: "07",
	aug: "08",
	sep: "09",
	oct: "10",
	nov: "11",
	dec: "12",
};

// LinkedIn's "Started On" / "Finished On" cells are "Mon YYYY" (e.g. "Jan 2020") or a bare year.
// Anything else is kept verbatim rather than dropped.
// LinkedIn writes "Jan 2020" (or a bare year); anything else stays as written and asks for a review.
function toLinkedInIsoDate(value = ""): string | null {
	const trimmed = value.trim();
	if (/^\d{4}$/.test(trimmed)) return trimmed;
	const monthYear = /^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(trimmed);
	const month = MONTHS[monthYear?.[1]?.toLowerCase() ?? ""];
	return monthYear && month ? `${monthYear[2]}-${month}` : null;
}

function formatLinkedInDate(value = ""): string {
	const iso = toLinkedInIsoDate(value);
	return iso ? formatDate(iso) : value.trim();
}

// Only an empty end cell means the entry is ongoing; an unrecognised one must not read as "Present".
function formatLinkedInPeriod(start?: string, end?: string): string {
	const from = formatLinkedInDate(start);
	const to = formatLinkedInDate(end);
	if (!from) return to;
	return `${from} - ${to || "Present"}`;
}

// Dates only when every cell was read; otherwise the text is read (and flagged if need be) when saved.
function linkedInPeriodDates(start?: string, end?: string): ResumeDates | undefined {
	const from = toLinkedInIsoDate(start);
	const to = toLinkedInIsoDate(end);
	if (!from || (end?.trim() && !to)) return undefined;
	return toRangeDates(from, to ?? undefined);
}

function linkedInSingleDates(value?: string): ResumeDates | undefined {
	const iso = toLinkedInIsoDate(value);
	return iso ? toSingleDates(iso) : undefined;
}

const textToHtml = (text = "") => toHtml(text.split(/\r\n?|\n/));

const languageLevel = (proficiency = "") =>
	// The lookbehind starts the match only at a whitespace run's first character, keeping long runs linear.
	knownLanguageLevel(proficiency.toLowerCase().replace(/(?<!\s)\s*proficiency$/, "")) ?? parseLevel(proficiency);

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1).toLowerCase();

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes (""), and commas/newlines
// inside quotes. LinkedIn's export files are small, so a non-streaming parser is enough.
// No BOM handling needed: TextDecoder strips a leading UTF-8 BOM before the text gets here.
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') inQuotes = true;
		else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function rowsToRecords(rows: string[][]): Record<string, string>[] {
	if (rows.length === 0) return [];
	const header = rows[0] ?? [];
	const body = rows.slice(1);
	return body.map((row) =>
		Object.fromEntries(row.slice(0, header.length).map((cell, i) => [(header[i] ?? "").trim(), cell.trim()])),
	);
}

function findCsv(files: Record<string, Uint8Array>, fileName: string): Record<string, string>[] {
	const decoder = new TextDecoder();
	const key = Object.keys(files).find((path) => basename(path) === fileName);
	if (!key) return [];
	return rowsToRecords(parseCsv(decoder.decode(files[key])));
}

const emptyWebsite = { url: "", label: "", inlineLink: false };
const linkWebsite = (url?: string) => (url ? { url, label: url, inlineLink: false } : emptyWebsite);

/**
 * Converts LinkedIn's "Download your data" export (a ZIP of per-topic CSVs) into ResumeData.
 * Only the CSVs relevant to a resume are read; the rest of the export is ignored.
 */
export function parseLinkedInExport(zipBytes: Uint8Array): ResumeData {
	let files: Record<string, Uint8Array>;
	const selected = new Set<string>();

	try {
		// Only inflate the first copy of each CSV we read; the rest of the export (messages, media, ...) can be large.
		files = unzipEntries(
			zipBytes,
			(name) => {
				const file = basename(name);
				if (!LINKEDIN_CSVS.has(file) || selected.has(file)) return false;
				selected.add(file);
				return true;
			},
			MAX_CSV_BYTES,
		);
	} catch (error) {
		if (error instanceof ZipEntryTooLargeError) {
			throw new Error(
				`"${error.entry}" in this ZIP is larger than 5 MB, which is too large for a LinkedIn data export. Upload the ZIP exactly as LinkedIn provided it.`,
			);
		}
		throw new Error(
			'This file could not be read as a ZIP archive. Export your data from LinkedIn\'s "Get a copy of your data" page and upload the ZIP as-is.',
		);
	}

	const profile = findCsv(files, "profile.csv")[0];
	const positions = findCsv(files, "positions.csv");
	const education = findCsv(files, "education.csv");
	const skills = findCsv(files, "skills.csv");
	const languages = findCsv(files, "languages.csv");
	const certifications = findCsv(files, "certifications.csv");

	if (!profile && positions.length === 0 && education.length === 0) {
		throw new Error(
			"This ZIP isn't a LinkedIn data export. Upload the ZIP from LinkedIn's \"Get a copy of your data\" page; it includes Profile.csv, Positions.csv or Education.csv.",
		);
	}

	// structuredClone, not a shallow spread: `result.sections.x = ...` below would otherwise
	// mutate defaultResumeData's shared nested objects and leak into the next import call.
	const result: ResumeData = structuredClone(defaultResumeData);

	if (profile) {
		result.basics = {
			...defaultResumeData.basics,
			name: [profile["First Name"], profile["Last Name"]].filter(Boolean).join(" "),
			headline: profile.Headline || "",
			location: profile["Geo Location"] || "",
			website: { url: "", label: "" },
		};

		if (profile.Summary) {
			result.summary = { ...defaultResumeData.summary, content: textToHtml(profile.Summary), hidden: false };
		}
	}

	const companies = positions.filter((position) => position["Company Name"]);
	if (companies.length > 0) {
		result.sections.experience = {
			...defaultResumeData.sections.experience,
			items: companies.map((position) => ({
				id: generateId(),
				hidden: false,
				company: position["Company Name"] ?? "",
				position: position.Title || "",
				location: position.Location || "",
				period: formatLinkedInPeriod(position["Started On"], position["Finished On"]),
				dates: linkedInPeriodDates(position["Started On"], position["Finished On"]),
				website: emptyWebsite,
				roles: [],
				description: textToHtml(position.Description),
			})),
		};
	}

	const schools = education.filter((edu) => edu["School Name"]);
	if (schools.length > 0) {
		result.sections.education = {
			...defaultResumeData.sections.education,
			items: schools.map((edu) => ({
				id: generateId(),
				hidden: false,
				school: edu["School Name"] ?? "",
				degree: edu["Degree Name"] || "",
				area: "",
				grade: "",
				location: "",
				period: formatLinkedInPeriod(edu["Start Date"], edu["End Date"]),
				dates: linkedInPeriodDates(edu["Start Date"], edu["End Date"]),
				website: emptyWebsite,
				description: textToHtml(edu.Notes),
			})),
		};
	}

	const namedSkills = skills.filter((skill) => skill.Name);
	if (namedSkills.length > 0) {
		result.sections.skills = {
			...defaultResumeData.sections.skills,
			items: namedSkills.map((skill) => ({
				id: generateId(),
				hidden: false,
				icon: "star",
				iconColor: "",
				name: skill.Name ?? "",
				proficiency: "",
				level: 0,
				keywords: [],
			})),
		};
	}

	const namedLanguages = languages.filter((lang) => lang.Name);
	if (namedLanguages.length > 0) {
		result.sections.languages = {
			...defaultResumeData.sections.languages,
			items: namedLanguages.map((lang) => ({
				id: generateId(),
				hidden: false,
				language: lang.Name ?? "",
				fluency: lang.Proficiency || "",
				level: languageLevel(lang.Proficiency),
			})),
		};
	}

	const namedCertifications = certifications.filter((cert) => cert.Name);
	if (namedCertifications.length > 0) {
		result.sections.certifications = {
			...defaultResumeData.sections.certifications,
			items: namedCertifications.map((cert) => ({
				id: generateId(),
				hidden: false,
				title: cert.Name ?? "",
				issuer: cert.Authority || "",
				date: formatLinkedInDate(cert["Started On"]),
				dates: linkedInSingleDates(cert["Started On"]),
				website: linkWebsite(cert.Url),
				description: "",
			})),
		};
	}

	try {
		return resumeDataSchema.parse(result);
	} catch (error) {
		rethrowAsImportError(error);
	}
}

/*
 * LinkedIn profiles as a scraper reads them (Apify's `harvestapi~linkedin-profile-scraper`): one JSON object per
 * profile. Every field can be missing or null, dates can be a year alone, and text can carry stray spaces, so each
 * value is read on its own and anything unreadable is left out.
 */

type Json = Record<string, unknown>;

const record = (value: unknown): Json =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const records = (value: unknown): Json[] => (Array.isArray(value) ? value.map(record) : []);
const text = (value: unknown): string =>
	typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/** An http(s) address as written, with https:// added when it has no scheme; empty when it isn't one. */
function webAddress(value: unknown): string {
	const written = text(value);
	if (!written || /\s/.test(written)) return "";
	try {
		const url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(written) ? written : `https://${written}`);
		return /^https?:$/.test(url.protocol) ? url.toString() : "";
	} catch {
		return "";
	}
}

const itemWebsite = (url: string) => ({ url, label: "", inlineLink: false });

// A LinkedIn date: { month: "Jan", year: 2024 }, a year alone, or only text ("Present", "Jan 2024").
function linkedInYearMonth(value: unknown): string | null {
	const date = record(value);
	const year = typeof date.year === "number" ? date.year : Number.parseInt(text(date.year), 10);
	if (Number.isInteger(year) && year >= 1900 && year <= 2200) {
		const month =
			typeof date.month === "number"
				? String(date.month).padStart(2, "0")
				: MONTHS[text(date.month).slice(0, 3).toLowerCase()];
		return month && /^(?:0[1-9]|1[0-2])$/.test(month) ? `${year}-${month}` : String(year);
	}
	return toLinkedInIsoDate(text(date.text));
}

const isOngoing = (value: unknown) => /\b(?:present|now|current)\b/i.test(text(record(value).text));

function linkedInRange(start: unknown, end: unknown): ResumeDates | undefined {
	const from = linkedInYearMonth(start);
	if (!from) return undefined;
	const to = linkedInYearMonth(end);
	return { start: from, end: to, present: !to && isOngoing(end) };
}

// Dates inside a sentence: "Issued Sep 2023", "Annals of Data · Sep 5, 2023", "Oct 2004" or a year alone.
function looseYearMonth(value: string): string | null {
	for (const match of value.matchAll(/\b([A-Za-z]{3})[a-z]*\.?\s+(?:\d{1,2},?\s+)?(\d{4})\b/g)) {
		const month = MONTHS[match[1]?.toLowerCase() ?? ""];
		if (month && match[2]) return `${match[2]}-${month}`;
	}
	return /\b(19\d{2}|2[01]\d{2})\b/.exec(value)?.[1] ?? null;
}

const singleDates = (value: string): ResumeDates | undefined => {
	const date = looseYearMonth(value);
	return date ? { start: date, end: null, present: false } : undefined;
};

const dateText = (dates: ResumeDates | undefined) => (dates ? formatResumeDates(dates, { locale: "en-US" }) : "");

const paragraphs = (...lines: string[]) => textToHtml(lines.filter(Boolean).join("\n"));

/** Skill names: the full list when the profile has one, else the few LinkedIn shows at the top ("A • B • C"). */
function linkedInSkills(profile: Json): string[] {
	const listed = records(profile.skills).map((skill) => text(skill.name));
	const top = Array.isArray(profile.topSkills)
		? profile.topSkills.map(text)
		: text(profile.topSkills).split(/\s*[•,]\s*/);
	return [...new Set((listed.some(Boolean) ? listed : top).filter(Boolean))];
}

/** The person's photo at LinkedIn: the 400 px size when listed, else the full one. Empty when there is none. */
function linkedInPhoto(profile: Json): string {
	const picture = record(profile.profilePicture);
	const sizes = records(picture.sizes);
	const medium = sizes.find((size) => size.width === 400) ?? sizes.find((size) => Number(size.width) >= 200);
	return webAddress(medium?.url) || webAddress(profile.photo) || webAddress(picture.url);
}

/**
 * Converts one LinkedIn profile, as the scraper returns it, into ResumeData: details, summary, experience,
 * education, projects, volunteering, skills, languages, certifications, awards and publications, with the profile
 * itself under Profiles. `picture.url` holds the photo's address at LinkedIn, which expires: copy it before keeping it.
 */
export function parseLinkedInProfile(input: unknown): ResumeData {
	const profile = record(input);
	const result: ResumeData = structuredClone(defaultResumeData);
	const location = record(profile.location);

	result.basics = {
		...defaultResumeData.basics,
		name: [text(profile.firstName), text(profile.lastName)].filter(Boolean).join(" "),
		headline: text(profile.headline),
		location: text(location.linkedinText) || text(record(location.parsed).text),
		website: {
			url: (Array.isArray(profile.websites) ? profile.websites : []).map(webAddress).find(Boolean) ?? "",
			label: "",
		},
		customFields: [],
	};
	result.picture.url = linkedInPhoto(profile);
	const about = text(profile.about);
	if (about) result.summary = { ...defaultResumeData.summary, content: textToHtml(about), hidden: false };

	result.sections.experience.items = records(profile.experience)
		.filter((job) => text(job.companyName) || text(job.position))
		.map((job) => {
			const dates = linkedInRange(job.startDate, job.endDate);
			return {
				id: generateId(),
				hidden: false,
				company: text(job.companyName),
				position: text(job.position),
				location: text(job.location),
				period: dateText(dates),
				dates,
				website: emptyWebsite,
				roles: [],
				description: textToHtml(text(job.description)),
			};
		});

	result.sections.education.items = records(profile.education)
		.filter((school) => text(school.schoolName))
		.map((school) => {
			const period = text(school.period);
			const dates =
				linkedInRange(school.startDate, school.endDate) ??
				(period ? readLegacyDates(period, { locale: "en-US", single: false }) : undefined);
			return {
				id: generateId(),
				hidden: false,
				school: text(school.schoolName),
				degree: text(school.degree),
				area: text(school.fieldOfStudy),
				grade: text(school.grade),
				location: "",
				period: dateText(dates) || period,
				dates,
				website: emptyWebsite,
				description: textToHtml(text(school.description)),
			};
		});

	result.sections.projects.items = records(profile.projects)
		.filter((project) => text(project.title))
		.map((project) => {
			const dates = linkedInRange(project.startDate, project.endDate);
			return {
				id: generateId(),
				hidden: false,
				name: text(project.title),
				period: dateText(dates),
				dates,
				website: itemWebsite(webAddress(project.url ?? project.link)),
				description: textToHtml(text(project.description)),
			};
		});

	result.sections.volunteer.items = records(profile.volunteering)
		.filter((entry) => text(entry.organizationName))
		.map((entry) => {
			const dates = linkedInRange(entry.startDate, entry.endDate);
			return {
				id: generateId(),
				hidden: false,
				organization: text(entry.organizationName),
				location: "",
				period: dateText(dates),
				dates,
				website: emptyWebsite,
				description: paragraphs(text(entry.role), text(entry.cause), text(entry.description)),
			};
		});

	result.sections.skills.items = linkedInSkills(profile).map((name) => ({
		id: generateId(),
		hidden: false,
		icon: "star",
		iconColor: "",
		name,
		proficiency: "",
		level: 0,
		keywords: [],
	}));

	result.sections.languages.items = records(profile.languages)
		.filter((language) => text(language.name))
		.map((language) => ({
			id: generateId(),
			hidden: false,
			language: text(language.name),
			fluency: text(language.proficiency),
			level: languageLevel(text(language.proficiency)),
		}));

	result.sections.certifications.items = records(profile.certifications)
		.filter((certification) => text(certification.title))
		.map((certification) => {
			const dates = singleDates(text(certification.issuedAt));
			return {
				id: generateId(),
				hidden: false,
				title: text(certification.title),
				issuer: text(certification.issuedBy),
				date: dateText(dates),
				dates,
				website: itemWebsite(webAddress(certification.link ?? certification.credentialUrl)),
				description: "",
			};
		});

	result.sections.awards.items = records(profile.honorsAndAwards)
		.filter((award) => text(award.title))
		.map((award) => {
			const dates = singleDates(text(award.issuedAt));
			return {
				id: generateId(),
				hidden: false,
				title: text(award.title),
				awarder: text(award.issuedBy),
				date: dateText(dates),
				dates,
				website: emptyWebsite,
				description: textToHtml(text(award.description)),
			};
		});

	result.sections.publications.items = records(profile.publications)
		.filter((publication) => text(publication.title))
		.map((publication) => {
			// "Publisher · Sep 5, 2023": the last part is the date when it reads as one.
			const parts = text(publication.publishedAt)
				.split("·")
				.map((part) => part.trim())
				.filter(Boolean);
			const last = parts.at(-1) ?? "";
			const dates = singleDates(last);
			const publisher = dates ? parts.slice(0, -1).join(" · ") : parts.join(" · ");
			return {
				id: generateId(),
				hidden: false,
				title: text(publication.title),
				publisher,
				date: dateText(dates),
				dates,
				website: itemWebsite(webAddress(publication.link)),
				description: textToHtml(text(publication.description)),
			};
		});

	const username = text(profile.publicIdentifier);
	const profileUrl = webAddress(profile.linkedinUrl) || (username ? linkedInProfileUrl(username) : "");
	if (username || profileUrl)
		result.sections.profiles.items = [
			{
				id: generateId(),
				hidden: false,
				icon: getNetworkIcon("linkedin"),
				iconColor: "",
				network: "LinkedIn",
				username,
				website: { url: profileUrl, label: username, inlineLink: false },
			},
		];

	try {
		return resumeDataSchema.parse(result);
	} catch (error) {
		rethrowAsImportError(error);
	}
}

// Sections whose size LinkedIn reports in `sectionTotals`, by the key the scraper lists them under.
const COUNTED_SECTIONS = [
	"experience",
	"education",
	"projects",
	"volunteering",
	"skills",
	"languages",
	"certifications",
	"honorsAndAwards",
	"publications",
] as const;

/**
 * What to tell the person about a scraped profile: `private-profile` when it showed nothing past the name and
 * headline, `truncated` when LinkedIn counts more entries in a section than came back.
 */
export function linkedInProfileNotes(input: unknown): SourceNote[] {
	const profile = record(input);
	const notes: SourceNote[] = [];
	const shown = text(profile.about) || COUNTED_SECTIONS.some((section) => records(profile[section]).length > 0);
	if (!shown) notes.push("private-profile");
	const totals = record(profile.sectionTotals);
	const cut = COUNTED_SECTIONS.some((section) => {
		const total = totals[section];
		const read = section === "skills" ? linkedInSkills(profile).length : records(profile[section]).length;
		return typeof total === "number" && total > read;
	});
	if (shown && cut) notes.push("truncated");
	return notes;
}
