/**
 * The fictional people the gallery samples show, one per template, in English and Indonesian. Every name, company,
 * address, number and link is made up; the photos are Unsplash portraits, listed with their photographers in
 * `.agents/docs/template-showcase-sources.json`.
 */
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { sampleResumeData } from "@rezumi/schema/resume/sample";

export type Locale = "en" | "id";

/** A text in English, then Indonesian. A plain string reads the same in both (names, companies, tools). */
type Text = string | readonly [en: string, id: string];

type Link = { url: string; label: string };

type Dated = { period: Text };

/** Section keys a page can place. */
type SectionKey = "summary" | keyof ResumeData["sections"];

export type Persona = {
	/** The portrait in `tooling/templates/photos/<template>.jpg`; without it the sample shows no photo. */
	photo?: true;
	name: string;
	headline: Text;
	email: string;
	phone: string;
	location: Text;
	website?: Link;
	/** Extra contact lines; with a label they read as personal details ("Date of birth: …") where a template has them. */
	details?: readonly { icon: string; label?: Text; text: Text; link?: string }[];
	profiles?: readonly { network: string; username: string; url: string }[];
	/** `**text**` is set in bold. */
	summary: Text;
	experience?: readonly (Dated & { company: string; position: Text; location: Text; bullets: readonly Text[] })[];
	education?: readonly (Dated & {
		school: string;
		degree: Text;
		area: Text;
		grade?: Text;
		location: Text;
		description?: Text;
	})[];
	projects?: readonly (Dated & { name: Text; description: Text; website?: Link })[];
	skills?: readonly { name: Text; keywords?: readonly Text[]; proficiency?: Text; level?: number; icon?: string }[];
	languages?: readonly { language: Text; fluency: Text; level: number }[];
	interests?: readonly { name: Text; keywords?: readonly Text[]; icon?: string }[];
	awards?: readonly { title: Text; awarder: Text; date: Text; description?: Text }[];
	certifications?: readonly { title: Text; issuer: string; date: Text; description?: Text }[];
	publications?: readonly { title: string; publisher: string; date: Text; description?: Text }[];
	volunteer?: readonly (Dated & { organization: string; location: Text; description: Text })[];
	references?: readonly { name: string; position: Text; phone: string; description?: Text }[];
	/** Section titles other than the template's own ("Grants" for Awards). */
	titles?: Partial<Record<SectionKey, Text>>;
	/** Sections set in columns, so short lists sit side by side in a one-column template (Skills in 3). */
	columns?: Partial<Record<keyof ResumeData["sections"], number>>;
	/** Where the sections go: a one-column template prints the sidebar's after the main ones. */
	layout: { main: readonly SectionKey[]; sidebar: readonly SectionKey[] };
	/** Last changes to the resume, after the template's preset (Vector turns tool logos on). */
	finish?: (data: ResumeData) => void;
};

const pick = (text: Text | undefined, locale: Locale): string =>
	text === undefined ? "" : typeof text === "string" ? text : text[locale === "en" ? 0 : 1];

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const paragraph = (text: string) => (text ? `<p>${inline(text)}</p>` : "");

const bullets = (items: readonly string[]) =>
	items.length > 0 ? `<ul>${items.map((item) => `<li><p>${inline(item)}</p></li>`).join("")}</ul>` : "";

const noLink = { url: "", label: "", inlineLink: false };

/** The persona's resume in `locale`, on `template` and without its preset (the script applies it). */
export function buildPersonaResume(persona: Persona, template: Template, locale: Locale, photoUrl = ""): ResumeData {
	const t = (text: Text | undefined) => pick(text, locale);
	const id = (section: string, index: number) => `${template}-${section}-${index + 1}`;
	const data = structuredClone(sampleResumeData);
	const sections = data.sections;

	data.picture = { ...data.picture, url: photoUrl, hidden: !photoUrl };
	data.basics = {
		name: persona.name,
		headline: t(persona.headline),
		email: persona.email,
		phone: persona.phone,
		location: t(persona.location),
		website: persona.website ?? { url: "", label: "" },
		customFields: (persona.details ?? []).map((detail, index) => ({
			id: id("detail", index),
			icon: detail.icon,
			...(detail.label ? { label: t(detail.label) } : {}),
			text: t(detail.text),
			link: detail.link ?? "",
		})),
	};
	data.summary = { ...data.summary, title: t(persona.titles?.summary), content: paragraph(t(persona.summary)) };

	const fill = <K extends keyof ResumeData["sections"]>(key: K, items: ResumeData["sections"][K]["items"]) => {
		Object.assign(sections[key], {
			title: t(persona.titles?.[key]),
			columns: persona.columns?.[key] ?? 1,
			hidden: false,
			items,
		});
	};

	fill(
		"profiles",
		(persona.profiles ?? []).map((profile, index) => ({
			id: id("profile", index),
			hidden: false,
			icon: "",
			iconColor: "",
			network: profile.network,
			username: profile.username,
			website: { url: profile.url, label: profile.url.replace(/^https?:\/\/(www\.)?/, ""), inlineLink: false },
		})),
	);
	fill(
		"experience",
		(persona.experience ?? []).map((job, index) => ({
			id: id("experience", index),
			hidden: false,
			company: job.company,
			position: t(job.position),
			location: t(job.location),
			period: t(job.period),
			website: noLink,
			roles: [],
			description: bullets(job.bullets.map(t)),
		})),
	);
	fill(
		"education",
		(persona.education ?? []).map((school, index) => ({
			id: id("education", index),
			hidden: false,
			school: school.school,
			degree: t(school.degree),
			area: t(school.area),
			grade: t(school.grade),
			location: t(school.location),
			period: t(school.period),
			website: noLink,
			description: paragraph(t(school.description)),
		})),
	);
	fill(
		"projects",
		(persona.projects ?? []).map((project, index) => ({
			id: id("project", index),
			hidden: false,
			name: t(project.name),
			period: t(project.period),
			website: project.website ? { ...project.website, inlineLink: false } : noLink,
			description: paragraph(t(project.description)),
		})),
	);
	fill(
		"skills",
		(persona.skills ?? []).map((skill, index) => ({
			id: id("skill", index),
			hidden: false,
			icon: skill.icon ?? "",
			iconColor: "",
			name: t(skill.name),
			proficiency: t(skill.proficiency),
			level: skill.level ?? 0,
			keywords: (skill.keywords ?? []).map(t),
		})),
	);
	fill(
		"languages",
		(persona.languages ?? []).map((language, index) => ({
			id: id("language", index),
			hidden: false,
			language: t(language.language),
			fluency: t(language.fluency),
			level: language.level,
		})),
	);
	fill(
		"interests",
		(persona.interests ?? []).map((interest, index) => ({
			id: id("interest", index),
			hidden: false,
			icon: interest.icon ?? "",
			iconColor: "",
			name: t(interest.name),
			keywords: (interest.keywords ?? []).map(t),
		})),
	);
	fill(
		"awards",
		(persona.awards ?? []).map((award, index) => ({
			id: id("award", index),
			hidden: false,
			title: t(award.title),
			awarder: t(award.awarder),
			date: t(award.date),
			website: noLink,
			description: paragraph(t(award.description)),
		})),
	);
	fill(
		"certifications",
		(persona.certifications ?? []).map((certification, index) => ({
			id: id("certification", index),
			hidden: false,
			title: t(certification.title),
			issuer: certification.issuer,
			date: t(certification.date),
			website: noLink,
			description: paragraph(t(certification.description)),
		})),
	);
	fill(
		"publications",
		(persona.publications ?? []).map((publication, index) => ({
			id: id("publication", index),
			hidden: false,
			title: publication.title,
			publisher: publication.publisher,
			date: t(publication.date),
			website: noLink,
			description: paragraph(t(publication.description)),
		})),
	);
	fill(
		"volunteer",
		(persona.volunteer ?? []).map((volunteer, index) => ({
			id: id("volunteer", index),
			hidden: false,
			organization: volunteer.organization,
			location: t(volunteer.location),
			period: t(volunteer.period),
			website: noLink,
			description: paragraph(t(volunteer.description)),
		})),
	);
	fill(
		"references",
		(persona.references ?? []).map((reference, index) => ({
			id: id("reference", index),
			hidden: false,
			name: reference.name,
			position: t(reference.position),
			website: noLink,
			phone: reference.phone,
			description: paragraph(t(reference.description)),
		})),
	);
	data.customSections = [];

	data.metadata.template = template;
	data.metadata.page.locale = locale === "en" ? "en-US" : "id-ID";
	data.metadata.layout.pages = [
		{ fullWidth: false, main: [...persona.layout.main], sidebar: [...persona.layout.sidebar] },
	];
	return data;
}
