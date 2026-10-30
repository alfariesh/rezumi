/**
 * Fills one local account with realistic documents, so every editor, list and board has something to show:
 * resumes in several templates, languages and states (public, locked, password, blank, long, in Trash) with
 * version history, cover letters (structured, freeform, linked, locked, trashed), and applications across every
 * stage with contacts, notes and past and upcoming interviews.
 *
 *   pnpm seed:dev --email you@example.test
 *
 * It replaces that account's resumes, letters and applications, and refuses any database that isn't on this
 * machine. Sign up through the app first; the seed never creates accounts.
 */
import type { ApplicationStatus, ApplicationTimelineEntry, Contact } from "@rezumi/schema/applications/data";
import type { CoverLetterLayout } from "@rezumi/schema/cover-letter/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { parseArgs } from "node:util";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@rezumi/db/schema";
import { copyCoverLetterStyle } from "@rezumi/resume/cover-letter";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { generateId } from "@rezumi/utils/string";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const { values: args } = parseArgs({ options: { email: { type: "string" } } });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run through `pnpm seed:dev`, which loads .env.local.");
if (!LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
	throw new Error("Refusing to seed: DATABASE_URL must point at a database on this machine.");
}
if (!args.email) throw new Error("Pass the account to fill: pnpm seed:dev --email you@example.test");

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle({ client: pool });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY);
/** A whole hour, `days` from today (negative for the past), so interviews land on sensible times. */
const at = (days: number, hour: number) => {
	const date = new Date(now + days * DAY);
	date.setHours(hour, 0, 0, 0);
	return date;
};

// --- Resumes ---------------------------------------------------------------------------------------------------

type Persona = {
	name: string;
	headline: string;
	email: string;
	location: string;
	summary: string;
	template: Template;
	primary: string;
	format?: "a4" | "letter";
	locale?: string;
	picture?: boolean;
	fonts?: { body: string; heading: string };
};

const html = (...paragraphs: string[]) => paragraphs.map((text) => `<p>${text}</p>`).join("");
const bullets = (...items: string[]) => `<ul>${items.map((item) => `<li><p>${item}</p></li>`).join("")}</ul>`;

/** The sample resume, worn by someone else: their name, headline, summary and look, the sample's sections. */
function personaResume(persona: Persona): ResumeData {
	const data = structuredClone(sampleResumeData);
	data.basics = {
		...data.basics,
		name: persona.name,
		headline: persona.headline,
		email: persona.email,
		location: persona.location,
	};
	data.picture.hidden = !persona.picture;
	data.summary.content = persona.summary;
	data.metadata.template = persona.template;
	data.metadata.design.colors.primary = persona.primary;
	data.metadata.page.format = persona.format ?? "a4";
	data.metadata.page.locale = persona.locale ?? "en-US";
	if (persona.fonts) {
		data.metadata.typography.body.fontFamily = persona.fonts.body;
		data.metadata.typography.heading.fontFamily = persona.fonts.heading;
	}
	return data;
}

function experience(company: string, position: string, period: string, location: string, description: string) {
	return {
		id: generateId(),
		hidden: false,
		company,
		position,
		location,
		period,
		website: { url: "", label: "", inlineLink: false },
		roles: [],
		description,
	};
}

const frontend = personaResume({
	name: "Maya Lindqvist",
	headline: "Senior Frontend Engineer · Design Systems",
	email: "maya.lindqvist@example.com",
	location: "Stockholm, Sweden",
	template: "pikachu",
	primary: "rgba(4, 133, 247, 1)",
	picture: true,
	fonts: { body: "Inter", heading: "Inter" },
	summary: html(
		"<strong>Frontend engineer with 8 years building design systems and accessible product UI.</strong> I turn messy component libraries into calm, documented systems that teams actually adopt, and I care about performance budgets as much as pixels.",
	),
});
frontend.sections.experience.items = [
	experience(
		"Northwind Payments",
		"Senior Frontend Engineer",
		"Apr 2022 – Present",
		"Stockholm",
		bullets(
			"Led the rebuild of the checkout UI on React Aria, cutting accessibility defects by 70% and checkout drop-off by 4%",
			"Own the design-system roadmap: 60+ components, tokens in OKLCH, visual regression on every pull request",
			"Mentor four engineers; introduced RFCs for cross-team UI decisions",
		),
	),
	experience(
		"Fjord Labs",
		"Frontend Engineer",
		"Aug 2018 – Mar 2022",
		"Gothenburg",
		bullets(
			"Shipped the analytics dashboard used by 3,000 customers, with virtualised tables of 100k rows",
			"Moved the build from Webpack to Vite, halving CI time",
		),
	),
];

const designer = personaResume({
	name: "Tomás Ferreira",
	headline: "Product Designer — Fintech & Mobile",
	email: "tomas.ferreira@example.com",
	location: "Lisbon, Portugal",
	template: "ditto",
	primary: "rgba(234, 88, 12, 1)",
	format: "letter",
	picture: true,
	summary: html(
		"Product designer who ships. Six years across fintech and mobile, from research to polished interaction details, with a habit of prototyping in code.",
	),
});

const dataScientist = personaResume({
	name: "Priya Raman",
	headline: "Data Scientist · Forecasting & Experimentation",
	email: "priya.raman@example.com",
	location: "Austin, TX",
	template: "kakuna",
	primary: "rgba(15, 118, 110, 1)",
	format: "letter",
	summary: html(
		"Data scientist focused on demand forecasting and A/B testing at scale. Comfortable from SQL to production Python, and in front of executives explaining what the numbers mean.",
	),
});

const indonesian = personaResume({
	name: "Rina Wulandari",
	headline: "Manajer Pemasaran Digital",
	email: "rina.wulandari@example.com",
	location: "Jakarta, Indonesia",
	template: "gengar",
	primary: "rgba(190, 18, 60, 1)",
	locale: "id-ID",
	picture: true,
	summary: html(
		"<strong>Pemasar digital dengan 7 tahun pengalaman</strong> memimpin kampanye performa, SEO dan konten untuk merek e-commerce dan fintech. Terbiasa bekerja dengan data, anggaran besar dan tim lintas fungsi.",
	),
});
indonesian.sections.experience.items = [
	experience(
		"Tokoku Indonesia",
		"Manajer Pemasaran Digital",
		"Jan 2021 – Sekarang",
		"Jakarta",
		bullets(
			"Memimpin tim 9 orang untuk kampanye performa dengan anggaran Rp 18 M per tahun",
			"Menaikkan konversi organik 38% lewat program SEO dan konten",
			"Membangun dasbor atribusi bersama tim data",
		),
	),
	experience(
		"KopiKita",
		"Spesialis Pemasaran",
		"Mar 2017 – Des 2020",
		"Bandung",
		bullets("Meluncurkan program loyalitas dengan 250 ribu anggota", "Mengelola kanal media sosial dan kemitraan"),
	),
];

const arabic = personaResume({
	name: "ليلى حداد",
	headline: "مهندسة برمجيات أولى",
	email: "layla.haddad@example.com",
	location: "دبي، الإمارات",
	template: "chikorita",
	primary: "rgba(109, 40, 217, 1)",
	locale: "ar-SA",
	summary: html(
		"مهندسة برمجيات بخبرة تسع سنوات في بناء أنظمة خلفية موزعة وواجهات برمجية عالية الأداء، مع اهتمام خاص بجودة الشيفرة وتوجيه الفرق.",
	),
});

const longResume = personaResume({
	name: "Jonathan Okafor",
	headline: "Engineering Director · Platform & Infrastructure",
	email: "jonathan.okafor@example.com",
	location: "London, UK",
	template: "onyx",
	primary: "rgba(30, 41, 59, 1)",
	summary: html(
		"Engineering leader with 18 years across platform, infrastructure and developer experience. Built and ran organisations of 80+ engineers through hypergrowth, two acquisitions and a public listing.",
		"I care about reliable systems, clear ownership and teams that enjoy their work.",
	),
});
longResume.sections.experience.items = Array.from({ length: 7 }, (_, index) =>
	experience(
		["Helix Cloud", "Brightline", "Quanta Systems", "Atlas Data", "Meridian", "Corvid Labs", "Openfield"][index] ?? "",
		[
			"Director of Engineering",
			"Head of Platform",
			"Engineering Manager",
			"Staff Engineer",
			"Senior Engineer",
			"Engineer",
			"Junior Engineer",
		][index] ?? "",
		`${2024 - index * 3} – ${index === 0 ? "Present" : 2027 - index * 3}`,
		"London",
		bullets(
			"Grew the platform group from 12 to 45 engineers across five teams, with clear charters and on-call that people don't dread",
			"Cut cloud spend 31% while doubling traffic, through capacity planning and a shared cost dashboard",
			"Led the migration of 400 services to Kubernetes with zero customer-facing incidents",
			"Introduced engineering ladders, quarterly planning and an incident review culture adopted company-wide",
		),
	),
);

const blank = structuredClone(defaultResumeData);

type ResumeSeed = {
	key: string;
	name: string;
	slug: string;
	data: ResumeData;
	tags?: string[];
	isPublic?: boolean;
	isPrimary?: boolean;
	isLocked?: boolean;
	password?: string;
	trashedDaysAgo?: number;
	autoName?: boolean;
	updatedDaysAgo: number;
	createdDaysAgo: number;
};

const resumes: ResumeSeed[] = [
	{
		key: "frontend",
		name: "Maya — Senior Frontend",
		slug: "maya-frontend",
		data: frontend,
		tags: ["engineering", "2026"],
		isPublic: true,
		isPrimary: true,
		updatedDaysAgo: 0.1,
		createdDaysAgo: 120,
	},
	{
		key: "designer",
		name: "Tomás — Product Design",
		slug: "tomas-design",
		data: designer,
		tags: ["design"],
		updatedDaysAgo: 2,
		createdDaysAgo: 60,
	},
	{
		key: "data",
		name: "Priya — Data Science (ATS)",
		slug: "priya-data",
		data: dataScientist,
		tags: ["data", "ats"],
		isLocked: true,
		updatedDaysAgo: 9,
		createdDaysAgo: 200,
	},
	{
		key: "games",
		name: "David — Game Developer",
		slug: "david-games",
		data: structuredClone(sampleResumeData),
		tags: ["games"],
		isPublic: true,
		password: "seed-password",
		updatedDaysAgo: 4,
		createdDaysAgo: 90,
	},
	{
		key: "id",
		name: "Rina — Pemasaran (Bahasa Indonesia)",
		slug: "rina-pemasaran",
		data: indonesian,
		tags: ["marketing", "id"],
		updatedDaysAgo: 1,
		createdDaysAgo: 30,
	},
	{
		key: "ar",
		name: "Layla — Software Engineer (العربية)",
		slug: "layla-arabic",
		data: arabic,
		tags: ["rtl"],
		updatedDaysAgo: 14,
		createdDaysAgo: 45,
	},
	{
		key: "long",
		name: "Jonathan — Engineering Director (long)",
		slug: "jonathan-director",
		data: longResume,
		tags: ["leadership"],
		updatedDaysAgo: 21,
		createdDaysAgo: 400,
	},
	{
		key: "blank",
		name: "Untitled resume",
		slug: "untitled-resume",
		data: blank,
		autoName: true,
		updatedDaysAgo: 0.5,
		createdDaysAgo: 0.5,
	},
	{
		key: "old",
		name: "Old 2023 resume",
		slug: "old-2023",
		data: personaResume({
			name: "Maya Lindqvist",
			headline: "Frontend Engineer",
			email: "maya@example.com",
			location: "Gothenburg",
			template: "rhyhorn",
			primary: "rgba(71, 85, 105, 1)",
			summary: html("Frontend engineer, 2023 edition."),
		}),
		trashedDaysAgo: 3,
		updatedDaysAgo: 3,
		createdDaysAgo: 700,
	},
];

// --- Applications ----------------------------------------------------------------------------------------------

type ApplicationSeed = {
	key: string;
	company: string;
	role: string;
	status: ApplicationStatus;
	location: string;
	salary?: string;
	source?: string;
	resume?: string;
	tags?: string[];
	appliedDaysAgo: number;
	matchScore?: number;
	followUpInDays?: number;
	closedReason?: "accepted" | "not-selected" | "withdrew" | "accepted-other" | "no-response";
	contacts?: Contact[];
	interviews?: {
		inDays: number;
		hour: number;
		kind: "screening" | "technical" | "behavioral" | "onsite" | "other";
		minutes?: number;
		with?: string;
		location?: string;
		notes?: string;
	}[];
	notes?: string[];
};

const posting = (company: string, role: string) =>
	`${company} is hiring a ${role}.\n\nWhat you'll do\n- Own meaningful parts of our product end to end\n- Work closely with design, product and data\n- Raise the bar on quality, accessibility and performance\n\nWhat we're looking for\n- 5+ years of relevant experience\n- Strong communication and a bias for shipping\n- Experience with React, TypeScript and design systems is a plus\n\nWhat we offer\n- Remote-friendly, flexible hours\n- Learning budget and generous parental leave`;

const applications: ApplicationSeed[] = [
	{
		key: "linear",
		company: "Linear",
		role: "Senior Frontend Engineer",
		status: "interview",
		location: "Remote (EU)",
		salary: "€110k – €130k",
		source: "Referral",
		resume: "frontend",
		tags: ["dream"],
		appliedDaysAgo: 18,
		matchScore: 86,
		contacts: [
			{ name: "Elin Berg", role: "Engineering Manager", type: "Hiring Manager", email: "elin@example.com", phone: "" },
			{ name: "Sam Patel", role: "Recruiter", type: "Recruiter", email: "sam@example.com", phone: "+44 20 7946 0000" },
		],
		interviews: [
			{
				inDays: -9,
				hour: 10,
				kind: "screening",
				minutes: 30,
				with: "Sam Patel",
				notes: "Went well. Asked about design-system adoption.",
			},
			{ inDays: 2, hour: 14, kind: "technical", minutes: 90, with: "Elin Berg", location: "Google Meet" },
			{ inDays: 6, hour: 11, kind: "behavioral", minutes: 45 },
		],
		notes: ["Prep: their keyboard-first UX, Command menu, sync engine."],
	},
	{
		key: "vercel",
		company: "Vercel",
		role: "Design Engineer",
		status: "screening",
		location: "Remote",
		salary: "$150k – $180k",
		source: "LinkedIn",
		resume: "frontend",
		appliedDaysAgo: 7,
		matchScore: 78,
		interviews: [{ inDays: 1, hour: 16, kind: "screening", minutes: 30, location: "Zoom" }],
	},
	{
		key: "spotify",
		company: "Spotify",
		role: "Senior Web Engineer",
		status: "applied",
		location: "Stockholm",
		source: "Company site",
		resume: "frontend",
		appliedDaysAgo: 3,
		matchScore: 71,
		followUpInDays: 4,
	},
	{
		key: "klarna",
		company: "Klarna",
		role: "Staff Frontend Engineer",
		status: "offer",
		location: "Stockholm (hybrid)",
		salary: "SEK 95k / month",
		source: "Recruiter",
		resume: "frontend",
		tags: ["decide by Friday"],
		appliedDaysAgo: 40,
		matchScore: 82,
		interviews: [
			{ inDays: -30, hour: 9, kind: "screening" },
			{ inDays: -21, hour: 13, kind: "technical", minutes: 120 },
			{ inDays: -14, hour: 10, kind: "onsite", minutes: 240, location: "Sveavägen 46, Stockholm" },
		],
		notes: ["Offer received. Negotiating start date and equity refresh."],
	},
	{
		key: "figma",
		company: "Figma",
		role: "Product Designer, Editor",
		status: "interview",
		location: "London",
		source: "Referral",
		resume: "designer",
		appliedDaysAgo: 12,
		matchScore: 74,
		interviews: [{ inDays: 0, hour: 15, kind: "other", minutes: 60, notes: "Portfolio review" }],
	},
	{
		key: "monzo",
		company: "Monzo",
		role: "Senior Product Designer",
		status: "applied",
		location: "Remote (UK)",
		source: "Job board",
		resume: "designer",
		appliedDaysAgo: 5,
	},
	{
		key: "revolut",
		company: "Revolut",
		role: "Product Designer",
		status: "closed",
		closedReason: "not-selected",
		location: "Lisbon",
		resume: "designer",
		appliedDaysAgo: 50,
		notes: ["Feedback: strong craft, wanted more B2B experience."],
	},
	{
		key: "airbnb",
		company: "Airbnb",
		role: "Data Scientist, Pricing",
		status: "screening",
		location: "Remote (US)",
		salary: "$170k – $210k",
		source: "LinkedIn",
		resume: "data",
		appliedDaysAgo: 9,
		matchScore: 69,
		interviews: [{ inDays: 3, hour: 11, kind: "screening", minutes: 45 }],
	},
	{
		key: "doordash",
		company: "DoorDash",
		role: "Senior Data Scientist",
		status: "closed",
		closedReason: "no-response",
		location: "San Francisco",
		resume: "data",
		appliedDaysAgo: 65,
	},
	{
		key: "tokopedia",
		company: "Tokopedia",
		role: "Digital Marketing Lead",
		status: "interview",
		location: "Jakarta",
		salary: "Rp 45 jt / bulan",
		source: "Glints",
		resume: "id",
		appliedDaysAgo: 10,
		interviews: [{ inDays: 4, hour: 10, kind: "behavioral", minutes: 60, location: "Kantor Jakarta Selatan" }],
	},
	{
		key: "gojek",
		company: "Gojek",
		role: "Performance Marketing Manager",
		status: "saved",
		location: "Jakarta",
		source: "LinkedIn",
		appliedDaysAgo: 1,
		followUpInDays: 2,
	},
	{
		key: "careem",
		company: "Careem",
		role: "Senior Backend Engineer",
		status: "applied",
		location: "Dubai",
		resume: "ar",
		appliedDaysAgo: 6,
	},
	{
		key: "stripe",
		company: "Stripe",
		role: "Engineering Manager, Platform",
		status: "saved",
		location: "Remote",
		resume: "long",
		appliedDaysAgo: 0,
	},
	{
		key: "unity",
		company: "Unity",
		role: "Senior Gameplay Programmer",
		status: "closed",
		closedReason: "withdrew",
		location: "Copenhagen",
		resume: "games",
		appliedDaysAgo: 80,
	},
	{
		key: "riot",
		company: "Riot Games",
		role: "Gameplay Engineer",
		status: "closed",
		closedReason: "accepted-other",
		location: "Los Angeles",
		resume: "games",
		appliedDaysAgo: 120,
	},
	{
		key: "notion",
		company: "Notion",
		role: "Frontend Engineer",
		status: "saved",
		location: "New York",
		appliedDaysAgo: 2,
		tags: ["maybe"],
	},
];

const STAGE_ORDER: ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer", "closed"];

function timeline(seed: ApplicationSeed): ApplicationTimelineEntry[] {
	const entries: ApplicationTimelineEntry[] = [];
	const reached = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(seed.status) + 1);
	// Closed skips the stages in between when it came early.
	const stages = seed.status === "closed" ? ["saved", "applied", "closed"] : reached;
	stages.forEach((stage, index) => {
		const step = seed.appliedDaysAgo / Math.max(1, stages.length);
		entries.push({
			id: generateId(),
			type: "stage",
			stage: stage as ApplicationStatus,
			at: daysAgo(seed.appliedDaysAgo - index * step),
		});
	});
	for (const text of seed.notes ?? [])
		entries.push({ id: generateId(), type: "note", text, at: daysAgo(Math.max(0, seed.appliedDaysAgo / 3)) });
	for (const interview of seed.interviews ?? []) {
		entries.push({
			id: generateId(),
			type: "interview",
			at: at(interview.inDays, interview.hour),
			kind: interview.kind,
			durationMinutes: interview.minutes ?? 60,
			location: interview.location ?? "",
			notes: interview.notes ?? "",
			participants: interview.with ? [{ name: interview.with, role: "" }] : [],
			audience:
				interview.kind === "screening"
					? "recruiter"
					: interview.kind === "technical"
						? "practitioner"
						: "hiring-manager",
			timezone: "Europe/Stockholm",
		});
	}
	return entries.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

// --- Cover letters ---------------------------------------------------------------------------------------------

type LetterSeed = {
	name: string;
	resume: string;
	application?: string;
	layout: CoverLetterLayout;
	recipientName?: string;
	recipientCompany?: string;
	recipient?: string;
	content: string;
	linked?: boolean;
	isLocked?: boolean;
	trashedDaysAgo?: number;
	updatedDaysAgo: number;
};

const letters: LetterSeed[] = [
	{
		name: "Linear — Senior Frontend",
		resume: "frontend",
		application: "linear",
		layout: "structured",
		recipientName: "Elin Berg",
		recipientCompany: "Linear",
		linked: true,
		updatedDaysAgo: 0.2,
		content: html(
			"I've used Linear every day for three years, and the thing I admire most is how it never makes me wait. I'd love to help keep it that way as a Senior Frontend Engineer.",
			"At Northwind Payments I rebuilt our checkout on React Aria and led a design system of 60+ components. Accessibility defects fell by 70%, and the system is now the default for every new surface. I care about the details your team obviously cares about: keyboard flows, motion that explains, and performance budgets that hold.",
			"I'd be glad to talk about how I could contribute to the editor and the sync-heavy parts of the product.",
		),
	},
	{
		name: "Klarna — Staff Frontend",
		resume: "frontend",
		application: "klarna",
		layout: "structured",
		recipientName: "Hiring team",
		recipientCompany: "Klarna",
		isLocked: true,
		updatedDaysAgo: 35,
		content: html(
			"I'm applying for the Staff Frontend Engineer role. For the last four years I've led design-system and checkout work in payments, where reliability and clarity matter as much as speed.",
			"I'd bring a track record of cross-team technical leadership and a calm, documented way of making UI decisions.",
		),
	},
	{
		name: "Figma — Product Designer",
		resume: "designer",
		application: "figma",
		layout: "structured",
		recipientName: "Design team",
		recipientCompany: "Figma",
		updatedDaysAgo: 3,
		content: html(
			"Figma changed how I work with engineers, so the Editor team is the one I most want to join. My portfolio shows six years of fintech and mobile work, much of it prototyped in code.",
		),
	},
	{
		name: "Tokopedia — Digital Marketing Lead",
		resume: "id",
		application: "tokopedia",
		layout: "structured",
		recipientName: "Tim Rekrutmen",
		recipientCompany: "Tokopedia",
		updatedDaysAgo: 1,
		content: html(
			"Dengan hormat, saya ingin melamar posisi Digital Marketing Lead di Tokopedia. Selama tujuh tahun terakhir saya memimpin kampanye performa dan SEO untuk merek e-commerce, termasuk tim berisi sembilan orang dengan anggaran Rp 18 M per tahun.",
			"Saya yakin pengalaman saya dalam atribusi berbasis data dan kolaborasi lintas fungsi akan membantu Tokopedia tumbuh lebih cepat.",
		),
	},
	{
		name: "General — Freeform",
		resume: "data",
		layout: "freeform",
		recipient: html("Hiring Manager", "Acme Analytics", "500 Market Street", "San Francisco, CA"),
		updatedDaysAgo: 30,
		content: html(
			"Dear Hiring Manager,",
			"I'm writing to express my interest in data science roles on your forecasting team. My work on demand forecasting has saved millions in inventory costs, and I enjoy explaining models to the people who rely on them.",
			"Sincerely,<br>Priya Raman",
		),
	},
	{
		name: "Old draft",
		resume: "games",
		layout: "structured",
		recipientCompany: "Ubisoft",
		trashedDaysAgo: 5,
		updatedDaysAgo: 5,
		content: html("An old draft, kept in Trash."),
	},
];

// --- Write -----------------------------------------------------------------------------------------------------

async function main() {
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.email, args.email ?? ""))
		.limit(1);
	if (!user) throw new Error(`No account for ${args.email}. Sign up in the app first.`);

	await db.transaction(async (tx) => {
		// Letters and applications point at each other and at resumes: clear the links, then the rows.
		await tx
			.update(schema.application)
			.set({ coverLetterId: null, resumeId: null })
			.where(eq(schema.application.userId, user.id));
		await tx.delete(schema.coverLetter).where(eq(schema.coverLetter.userId, user.id));
		await tx.delete(schema.application).where(eq(schema.application.userId, user.id));
		await tx.delete(schema.resume).where(eq(schema.resume.userId, user.id));

		const resumeIds = new Map<string, string>();
		for (const seed of resumes) {
			const data = resumeDataSchema.parse(seed.data) as ResumeData;
			const id = generateId();
			resumeIds.set(seed.key, id);
			await tx.insert(schema.resume).values({
				id,
				userId: user.id,
				name: seed.name,
				slug: seed.slug,
				tags: seed.tags ?? [],
				data,
				isPublic: seed.isPublic ?? false,
				isPrimary: seed.isPrimary ?? false,
				isLocked: seed.isLocked ?? false,
				// Hashed as the API's setPassword does, so the password works on the public page.
				password: seed.password ? await hash(seed.password, 10) : null,
				autoName: seed.autoName ?? false,
				trashedAt: seed.trashedDaysAgo === undefined ? null : daysAgo(seed.trashedDaysAgo),
				createdAt: daysAgo(seed.createdDaysAgo),
				updatedAt: daysAgo(seed.updatedDaysAgo),
			});

			// History: created, a named milestone, an AI edit and the last autosave, oldest first.
			const versions = [
				{ kind: "created" as const, age: seed.createdDaysAgo },
				...(seed.createdDaysAgo > 20
					? [
							{ kind: "named" as const, age: seed.createdDaysAgo * 0.6, name: "Before the redesign" },
							{ kind: "ai" as const, age: seed.createdDaysAgo * 0.3 },
						]
					: []),
				{ kind: "auto" as const, age: seed.updatedDaysAgo, sessionId: generateId() },
			];
			for (const version of versions) {
				await tx.insert(schema.resumeVersion).values({
					resumeId: id,
					userId: user.id,
					data,
					kind: version.kind,
					name: "name" in version ? version.name : null,
					sessionId: "sessionId" in version ? version.sessionId : null,
					createdAt: daysAgo(version.age),
				});
			}
		}

		const applicationIds = new Map<string, string>();
		for (const seed of applications) {
			const id = generateId();
			applicationIds.set(seed.key, id);
			await tx.insert(schema.application).values({
				id,
				userId: user.id,
				company: seed.company,
				role: seed.role,
				location: seed.location,
				salary: seed.salary ?? null,
				status: seed.status,
				closedReason: seed.closedReason ?? null,
				resumeId: seed.resume ? (resumeIds.get(seed.resume) ?? null) : null,
				source: seed.source ?? null,
				tags: seed.tags ?? [],
				sourceUrl: `https://jobs.example.com/${seed.key}`,
				jobDescription: posting(seed.company, seed.role),
				requirements: ["React", "TypeScript", "Design systems", "Accessibility", "Testing"],
				matchScore: seed.matchScore ?? null,
				followUpAt: seed.followUpInDays === undefined ? null : at(seed.followUpInDays, 9),
				followUpNote: seed.followUpInDays === undefined ? null : "Check in with the recruiter",
				contacts: seed.contacts ?? [],
				activity: timeline(seed),
				appliedAt: daysAgo(seed.appliedDaysAgo),
				createdAt: daysAgo(seed.appliedDaysAgo + 1),
				updatedAt: daysAgo(Math.min(seed.appliedDaysAgo, 2)),
			});
		}

		for (const seed of letters) {
			const resume = resumes.find((item) => item.key === seed.resume);
			if (!resume) continue;
			const id = generateId();
			const applicationId = seed.application ? (applicationIds.get(seed.application) ?? null) : null;
			await tx.insert(schema.coverLetter).values({
				id,
				userId: user.id,
				name: seed.name,
				layout: seed.layout,
				recipient: seed.recipient ?? "",
				recipientName: seed.recipientName ?? "",
				recipientCompany: seed.recipientCompany ?? "",
				letterDate: seed.layout === "structured" ? daysAgo(seed.updatedDaysAgo).toISOString().slice(0, 10) : null,
				content: seed.content,
				style: copyCoverLetterStyle(resumeDataSchema.parse(resume.data) as ResumeData),
				sourceResumeId: resumeIds.get(seed.resume) ?? null,
				sourceApplicationId: applicationId,
				senderLinked: seed.linked ?? false,
				designLinked: seed.linked ?? false,
				isLocked: seed.isLocked ?? false,
				trashedAt: seed.trashedDaysAgo === undefined ? null : daysAgo(seed.trashedDaysAgo),
				createdAt: daysAgo(seed.updatedDaysAgo + 4),
				updatedAt: daysAgo(seed.updatedDaysAgo),
			});
			if (applicationId)
				if (applicationId) {
					// Keeps the application's own date: the ORM would stamp this update as now.
					const appliedDaysAgo = applications.find((item) => item.key === seed.application)?.appliedDaysAgo ?? 0;
					await tx
						.update(schema.application)
						.set({ coverLetterId: id, updatedAt: daysAgo(Math.min(appliedDaysAgo, 2)) })
						.where(eq(schema.application.id, applicationId));
				}
		}
	});

	console.info(
		`Seeded ${args.email}: ${resumes.length} resumes, ${letters.length} cover letters, ${applications.length} applications.`,
	);
}

try {
	await main();
} finally {
	await pool.end();
}
