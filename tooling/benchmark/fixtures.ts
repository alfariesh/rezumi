/**
 * The benchmark's fictional inputs (fixtures/*.json) and what the procedures take from them: resume data, plain text
 * for the ATS review, and PDF/DOCX files for the AI import. Every name, company, email and phone in the fixtures is
 * made up; none of it comes from real users.
 */
import type { ResumeData } from "@rezumi/schema/resume/data";
import { readFileSync } from "node:fs";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { defaultResumeData, sectionDefaults } from "@rezumi/schema/resume/default";
import { generateId } from "@rezumi/utils/string";

export type Language = "id" | "en";

export type ResumeFixture = {
	id: string;
	language: Language;
	persona: "fresh-graduate" | "1-5-years" | "career-switch" | "long";
	name: string;
	headline: string;
	email: string;
	phone: string;
	location: string;
	summary: string;
	experience: { company: string; position: string; location: string; period: string; bullets: string[] }[];
	education: { school: string; degree: string; area: string; period: string; grade: string }[];
	skills: { name: string; keywords: string[] }[];
	languages: { language: string; fluency: string }[];
	projects: { name: string; period: string; description: string }[];
};

export type JobFixture = {
	id: string;
	language: Language;
	company: string;
	role: string;
	location: string;
	salary: string;
	description: string;
	/** The resumes that fit this posting well. */
	matches: string[];
};

export type TaskFixtures = {
	improve: {
		resume: string;
		where: string;
		line: string;
		action: "verb" | "result" | "shorter" | "custom";
		request?: string;
	}[];
	recruiterMessages: { job: string; message: string }[];
	formQuestions: { job: string; question: string; answer: string }[];
	practice: { job: string; question: string; answer: string }[];
	debrief: { job: string; question: string; answer: string; landed: "well" | "mixed" | "not" }[];
	coach: { scope: "document" | "application"; resume?: string; job?: string; turns: string[] }[];
};

const read = <T>(name: string): T =>
	JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8")) as T;

export function loadFixtures() {
	const resumes = read<ResumeFixture[]>("resumes.json");
	const jobs = read<JobFixture[]>("jobs.json");
	const tasks = read<TaskFixtures>("tasks.json");
	return { resumes, jobs, tasks };
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paragraph = (text: string) => (text ? `<p>${escape(text)}</p>` : "");
const list = (items: string[]) =>
	items.length ? `<ul>${items.map((item) => `<li><p>${escape(item)}</p></li>`).join("")}</ul>` : "";
const noLink = { url: "", label: "", inlineLink: false };

/** The fixture as resume data, in the shape the editor saves: one-column Meridian, A4, in the resume's language. */
export function toResumeData(resume: ResumeFixture): ResumeData {
	const base = structuredClone(defaultResumeData);
	const data: ResumeData = {
		...base,
		basics: {
			...base.basics,
			name: resume.name,
			headline: resume.headline,
			email: resume.email,
			phone: resume.phone,
			location: resume.location,
		},
		summary: { ...base.summary, content: paragraph(resume.summary) },
		sections: {
			...base.sections,
			experience: {
				...sectionDefaults("briefcase"),
				items: resume.experience.map((job) => ({
					id: generateId(),
					hidden: false,
					company: job.company,
					position: job.position,
					location: job.location,
					period: job.period,
					website: noLink,
					roles: [],
					description: list(job.bullets),
				})),
			},
			education: {
				...sectionDefaults("graduation-cap"),
				items: resume.education.map((school) => ({
					id: generateId(),
					hidden: false,
					school: school.school,
					degree: school.degree,
					area: school.area,
					grade: school.grade,
					location: "",
					period: school.period,
					website: noLink,
					description: "",
				})),
			},
			skills: {
				...base.sections.skills,
				items: resume.skills.map((skill) => ({
					id: generateId(),
					hidden: false,
					icon: "",
					iconColor: "",
					name: skill.name,
					proficiency: "",
					level: 0,
					keywords: skill.keywords,
				})),
			},
			languages: {
				...sectionDefaults("translate"),
				items: resume.languages.map((language) => ({
					id: generateId(),
					hidden: false,
					language: language.language,
					fluency: language.fluency,
					level: 0,
				})),
			},
			projects: {
				...sectionDefaults("code-simple"),
				items: resume.projects.map((project) => ({
					id: generateId(),
					hidden: false,
					name: project.name,
					period: project.period,
					website: noLink,
					description: paragraph(project.description),
				})),
			},
		},
		metadata: {
			...base.metadata,
			page: { ...base.metadata.page, locale: resume.language === "id" ? "id-ID" : "en-US" },
		},
	};
	return resumeDataSchema.parse(data);
}

/** The resume as the plain text a PDF extractor would give the ATS review. */
export function toPlainText(resume: ResumeFixture): string {
	return [
		resume.name,
		resume.headline,
		[resume.email, resume.phone, resume.location].join(" · "),
		"",
		resume.summary,
		"",
		...resume.experience.flatMap((job) => [
			`${job.position} — ${job.company} (${job.location}) ${job.period}`,
			...job.bullets.map((bullet) => `• ${bullet}`),
			"",
		]),
		...resume.education.map((school) =>
			[`${school.degree} ${school.area}, ${school.school} ${school.period}`, school.grade].filter(Boolean).join(" · "),
		),
		"",
		resume.skills.map((skill) => `${skill.name}: ${skill.keywords.join(", ")}`).join("\n"),
		resume.languages.map((language) => `${language.language} (${language.fluency})`).join(", "),
		...resume.projects.map((project) => `${project.name} ${project.period}: ${project.description}`),
	].join("\n");
}

/** Every bullet, numbered like the web's ATS checker numbers passages, for the review to rewrite. */
export function toPassages(resume: ResumeFixture) {
	return resume.experience.flatMap((job, jobIndex) =>
		job.bullets.map((text, bulletIndex) => ({
			id: `p${jobIndex + 1}-${bulletIndex + 1}`,
			where: `Experience · ${job.company} · bullet ${bulletIndex + 1}`,
			text: text.slice(0, 1_000),
		})),
	);
}

const toBase64 = async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString("base64");

// The renderers load on first use, so the report can read the fixtures without the PDF engine.

/** The resume printed by the server's own PDF renderer, as the AI import receives an uploaded file. */
export async function toPdf(resume: ResumeFixture) {
	const { createResumePdfFile } = await import("@rezumi/pdf/server");
	const file = await createResumePdfFile({ data: toResumeData(resume), filename: `${resume.id}.pdf` });
	return { name: file.name, data: await toBase64(file), bytes: file.size };
}

/** The resume as the web's Word export writes it. */
export async function toDocx(resume: ResumeFixture) {
	const { buildDocx } = await import("@rezumi/docx");
	const blob = await buildDocx(toResumeData(resume));
	return { name: `${resume.id}.docx`, data: await toBase64(blob), bytes: blob.size };
}
