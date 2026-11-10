/**
 * Fills one throwaway demo account with rich, fictional data so every dashboard screen and the plan UI have
 * something to show: resumes, cover letters, applications with interviews, career knowledge, offers, schedules,
 * notifications, a Trash and a Pro AI plan.
 *
 *   pnpm seed:demo
 *
 * Needs the app running (default http://127.0.0.1:3090, override with DEMO_BASE_URL) with admin billing tools on
 * (BILLING_MODE=admins), and DATABASE_URL pointing at the same local database (`pnpm seed:demo` loads .env.local).
 *
 * Everything goes through the app's own sign-up and API, signed in as the demo account, so the data is valid. Only
 * three things use SQL, all scoped to the demo account: verifying its email and giving it the admin role, saving the
 * offers, notifications and one coach conversation that have no creation API (the app writes them from AI replies),
 * and a few discovered roles. Nothing calls an AI provider or a payment provider.
 *
 * Re-runnable: resumes and letters are found by name and updated, knowledge by text or title, and the demo account's
 * applications (with their schedules, offers and notifications) are deleted and recreated. Other accounts are never
 * touched.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// A throwaway local test credential for the demo account only.
const DEMO_PASSWORD = "Demo-Account-2026!";
const DEMO_EMAIL = "demo@example.test";
const DEMO_NAME = "Alex Demo";
const DEMO_USERNAME = "alexdemo";
const DEMO_TIMEZONE = "Asia/Jakarta";

const BASE_URL = (process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3090").replace(/\/$/, "");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run `pnpm seed:demo`, which loads .env.local.");
if (!LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
	throw new Error("Refusing to seed: DATABASE_URL must point at a database on this machine.");
}
const pool = new Pool({ connectionString: databaseUrl });

// --- Dates -----------------------------------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const JAKARTA_OFFSET = 7 * HOUR;

/** The calendar day (YYYY-MM-DD) in Jakarta, `days` from today (negative for the past). */
const dayOf = (days) => new Date(Date.now() + JAKARTA_OFFSET + days * DAY).toISOString().slice(0, 10);
/** A Jakarta wall-clock time `days` from today, as an instant. */
const at = (days, hour, minute = 0) => {
	const [year, month, day] = dayOf(days).split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};
const hoursAgo = (hours) => new Date(Date.now() - hours * HOUR);

// --- HTTP ------------------------------------------------------------------------------------------------------

const jar = new Map();

function remember(response) {
	for (const cookie of response.headers.getSetCookie()) {
		const pair = cookie.split(";")[0] ?? "";
		const index = pair.indexOf("=");
		if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
	}
}

const headers = () => ({
	"content-type": "application/json",
	origin: BASE_URL,
	referer: `${BASE_URL}/`,
	cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
});

async function authPost(path, body) {
	const response = await fetch(`${BASE_URL}/api/auth/${path}`, {
		method: "POST",
		headers: headers(),
		body: JSON.stringify(body),
	});
	remember(response);
	const text = await response.text();
	return { status: response.status, ok: response.ok, body: text ? safeJson(text) : null };
}

function safeJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/** oRPC's wire format: Dates travel as ISO strings, listed by path in `meta` (type 1). */
function encode(value, path, meta) {
	if (value instanceof Date) {
		meta.push([1, ...path]);
		return value.toISOString();
	}
	if (Array.isArray(value)) return value.map((item, index) => encode(item, [...path, index], meta));
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, item]) => item !== undefined)
				.map(([key, item]) => [key, encode(item, [...path, key], meta)]),
		);
	}
	return value;
}

async function rpc(procedure, input = {}) {
	const meta = [];
	const json = encode(input, [], meta);
	const response = await fetch(`${BASE_URL}/api/rpc/${procedure}`, {
		method: "POST",
		headers: { ...headers(), "x-client-timezone": DEMO_TIMEZONE },
		body: JSON.stringify(meta.length > 0 ? { json, meta } : { json }),
	});
	const text = await response.text();
	const body = text ? safeJson(text) : null;
	if (!response.ok) {
		const detail = body && typeof body === "object" ? JSON.stringify(body.data ?? body.message ?? body) : String(body);
		throw new Error(`${procedure} failed (${response.status}): ${detail.slice(0, 600)}`);
	}
	return body && typeof body === "object" ? body.json : undefined;
}

// --- Resume content --------------------------------------------------------------------------------------------

const uuid = () => randomUUID();
const html = (...paragraphs) => paragraphs.map((text) => `<p>${text}</p>`).join("");
const bullets = (...items) => `<ul>${items.map((item) => `<li><p>${item}</p></li>`).join("")}</ul>`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (yearMonth) => {
	const [year, month] = yearMonth.split("-");
	return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
};
const period = (start, end) => `${label(start)} – ${end ? label(end) : "Present"}`;
const noSite = { url: "", label: "", inlineLink: false };

const experience = (company, position, location, start, end, description) => ({
	id: uuid(),
	hidden: false,
	company,
	position,
	location,
	period: period(start, end),
	dates: { start, end, present: end === null },
	website: noSite,
	roles: [],
	description,
});

const education = (school, degree, area, grade, location, start, end, description = "") => ({
	id: uuid(),
	hidden: false,
	school,
	degree,
	area,
	grade,
	location,
	period: period(start, end),
	dates: { start, end, present: false },
	website: noSite,
	description,
});

const skill = (name, proficiency, level, ...keywords) => ({
	id: uuid(),
	hidden: false,
	icon: "",
	iconColor: "",
	name,
	proficiency,
	level,
	keywords,
});

const certification = (title, issuer, date) => ({
	id: uuid(),
	hidden: false,
	title,
	issuer,
	date: label(date),
	dates: { start: date, end: null, present: false },
	website: noSite,
	description: "",
});

const basics = {
	name: DEMO_NAME,
	email: "alex.demo@example.test",
	phone: "+62 812 5550 0101",
	location: "Jakarta, Indonesia",
	website: { url: "https://alexdemo.example.com", label: "alexdemo.example.com" },
};

const RESUMES = [
	{
		name: "Alex Demo - Product Manager",
		slug: "alex-demo-product-manager",
		tags: ["product", "main"],
		template: "meridian",
		primary: "rgba(37, 99, 235, 1)",
		isPublic: true,
		headline: "Senior Product Manager · B2B SaaS & Fintech",
		summary: html(
			"<strong>Product manager with 8 years of experience</strong> taking B2B and fintech products from first discovery to scale. I pair customer research with hard numbers, and I like teams where design, engineering and data share one roadmap.",
		),
		experience: [
			experience(
				"Northstar Labs",
				"Senior Product Manager",
				"Jakarta",
				"2022-03",
				null,
				bullets(
					"Own the onboarding and activation roadmap for a workflow platform used by 1,800 teams",
					"Raised week-one activation from 31% to 47% through guided setup and role-based templates",
					"Lead a squad of 9 across design, engineering and data; run quarterly planning with three other squads",
				),
			),
			experience(
				"Orbital",
				"Product Manager",
				"Singapore",
				"2019-06",
				"2022-02",
				bullets(
					"Shipped a usage-based billing module that brought in USD 2.4M in its first year",
					"Cut support tickets by 28% by rebuilding the invoice and payment-method screens",
				),
			),
			experience(
				"Kopi Kita",
				"Associate Product Manager",
				"Bandung",
				"2017-08",
				"2019-05",
				bullets(
					"Launched the loyalty programme across 140 coffee shops, reaching 90,000 members in 10 months",
					"Ran the first A/B testing practice for the mobile ordering app",
				),
			),
		],
		education: [
			education(
				"Nusantara Institute of Technology",
				"Bachelor of Science",
				"Information Systems",
				"GPA 3.7 / 4.0",
				"Bandung",
				"2013-08",
				"2017-07",
			),
		],
		skills: [
			skill("Product discovery", "Expert", 5, "Interviews", "Jobs to be done", "Opportunity trees"),
			skill("Roadmapping", "Advanced", 4, "OKRs", "Prioritisation", "Stakeholder alignment"),
			skill("Analytics", "Advanced", 4, "SQL", "Amplitude", "Experiment design"),
			skill("Delivery", "Advanced", 4, "Jira", "Agile", "Release management"),
		],
		certifications: [certification("Certified Scrum Product Owner", "Scrum Alliance (fictional)", "2020-09")],
	},
	{
		name: "Alex Demo - Data Analyst",
		slug: "alex-demo-data-analyst",
		tags: ["data", "analytics"],
		template: "atlas",
		primary: "rgba(5, 150, 105, 1)",
		headline: "Product & Growth Analyst · SQL, Experimentation",
		summary: html(
			"Analyst who turns messy product data into decisions. Strong in SQL, experiment design and dashboards that people actually open on Monday morning.",
		),
		experience: [
			experience(
				"Orbital",
				"Product Analyst",
				"Singapore",
				"2019-06",
				"2022-02",
				bullets(
					"Built the weekly growth dashboard used by 40 managers, replacing 6 manual spreadsheets",
					"Designed 35 A/B tests; 12 shipped, adding an estimated 6% to trial-to-paid conversion",
				),
			),
			experience(
				"Kopi Kita",
				"Business Intelligence Intern",
				"Bandung",
				"2016-06",
				"2016-12",
				bullets("Modelled store traffic against weather and promotions for 140 locations"),
			),
		],
		education: [
			education(
				"Nusantara Institute of Technology",
				"Bachelor of Science",
				"Information Systems",
				"GPA 3.7 / 4.0",
				"Bandung",
				"2013-08",
				"2017-07",
			),
		],
		skills: [
			skill("SQL", "Expert", 5, "PostgreSQL", "BigQuery", "Window functions"),
			skill("Experimentation", "Advanced", 4, "A/B testing", "CUPED", "Power analysis"),
			skill("Visualisation", "Advanced", 4, "Metabase", "Looker Studio"),
		],
		certifications: [],
	},
	{
		name: "Alex Demo - Operations (Final)",
		slug: "alex-demo-operations",
		tags: ["operations", "archive"],
		template: "sterling",
		primary: "rgba(30, 41, 59, 1)",
		isLocked: true,
		headline: "Operations Lead · Retail & Logistics",
		summary: html(
			"Operations lead who keeps stores, suppliers and software running together. This copy is locked: it is the version sent to a recruiter in 2023.",
		),
		experience: [
			experience(
				"Kopi Kita",
				"Operations Lead",
				"Bandung",
				"2017-08",
				"2019-05",
				bullets(
					"Standardised opening procedures across 140 shops, cutting stock-outs by 22%",
					"Negotiated a two-year logistics contract that saved IDR 1.1 billion",
				),
			),
		],
		education: [
			education(
				"Nusantara Institute of Technology",
				"Bachelor of Science",
				"Information Systems",
				"GPA 3.7 / 4.0",
				"Bandung",
				"2013-08",
				"2017-07",
			),
		],
		skills: [
			skill("Supply chain", "Advanced", 4, "Inventory", "Vendor management"),
			skill("Process design", "Advanced", 4, "Lean", "SOPs"),
		],
		certifications: [],
	},
];

const TRASHED_RESUME = {
	name: "Alex Demo - Old Draft 2023",
	tags: ["draft"],
	template: "tunas",
	primary: "rgba(190, 18, 60, 1)",
	headline: "Product Manager (old draft)",
	summary: html("Early draft kept for reference. Replaced by the main product manager resume."),
	experience: [
		experience(
			"Orbital",
			"Product Manager",
			"Singapore",
			"2019-06",
			"2022-02",
			bullets("Billing module, support tools"),
		),
	],
	education: [],
	skills: [skill("Product", "Advanced", 4, "Roadmaps")],
	certifications: [],
};

function resumeData(base, spec) {
	const data = structuredClone(base);
	data.basics = { ...data.basics, ...basics, headline: spec.headline };
	data.picture.hidden = true;
	data.summary.content = spec.summary;
	data.sections.experience.items = spec.experience;
	data.sections.education.items = spec.education;
	data.sections.skills.items = spec.skills;
	data.sections.certifications.items = spec.certifications;
	data.metadata.template = spec.template;
	data.metadata.design.colors.primary = spec.primary;
	data.metadata.page.locale = "en-US";
	return data;
}

const letterBody = (company, role, lines) =>
	html(
		`I am writing to apply for the ${role} role at ${company}. ${lines[0]}`,
		lines[1],
		lines[2],
		"I would welcome the chance to talk about how I can help. Thank you for your time and consideration.",
	);

const LETTERS = [
	{
		name: "Cover letter - Northstar Labs",
		tags: ["northstar", "product"],
		recipientName: "Hiring Team",
		recipientCompany: "Northstar Labs",
		application: "Northstar Labs",
		resume: "Alex Demo - Product Manager",
		content: letterBody("Northstar Labs", "Senior Product Manager", [
			"For the past three years I have owned onboarding for a workflow platform, and I would like to do the same for your customers.",
			"At my current company I raised week-one activation from 31% to 47% by pairing customer interviews with a small number of focused experiments. I would bring the same approach to your onboarding squad.",
			"I also enjoy the part many product managers skip: writing the plan down so that design, engineering and data can all challenge it.",
		]),
	},
	{
		name: "Cover letter - General Product Roles",
		tags: ["general"],
		recipientName: "",
		recipientCompany: "",
		resume: "Alex Demo - Product Manager",
		content: letterBody("your company", "Product Manager", [
			"I have spent eight years building B2B and fintech products, from the first customer interview to the third pricing change.",
			"My best work has come from short loops: talk to ten customers, ship the smallest thing that teaches us something, then measure it honestly.",
			"I am looking for a team that takes discovery seriously and treats numbers as a conversation, not a verdict.",
		]),
	},
];

const TRASHED_LETTER = {
	name: "Cover letter - Old Template",
	tags: ["draft"],
	recipientName: "",
	recipientCompany: "",
	content: html("An early letter kept for reference. Replaced by the general product roles letter."),
};

// --- Applications ----------------------------------------------------------------------------------------------

const recruiter = (name, role, email) => ({
	name,
	role,
	type: "Recruiter",
	email,
	phone: "+62 21 5550 0100",
});

const participant = (name, role) => ({ name, role });

const APPLICATIONS = [
	{
		company: "Lumen Bank",
		role: "Digital Product Owner",
		location: "Jakarta (hybrid)",
		salary: "IDR 45–55 million / month",
		source: "Referral",
		tags: ["fintech", "saved"],
		path: [["saved", 2]],
		jobDescription:
			"Own the digital savings journey for retail customers. Work with design, engineering and risk to ship quarterly releases.",
		requirements: ["5+ years in product ownership", "Experience with regulated products", "Strong analytical skills"],
		notes: [[1, "Kopi Kita friend referred me. Ask for an intro before applying."]],
	},
	{
		company: "Kopi Kita",
		role: "Growth Product Manager",
		location: "Bandung (on-site)",
		salary: "IDR 38–46 million / month",
		source: "Company website",
		tags: ["consumer", "saved"],
		path: [["saved", 4]],
		requirements: ["Loyalty or retention experience", "Comfortable with SQL"],
		notes: [[3, "Old employer. Would be a return, with a bigger scope."]],
	},
	{
		company: "Tidewater Logistics",
		role: "Product Manager, Platform",
		location: "Surabaya (remote friendly)",
		salary: "IDR 50–62 million / month",
		source: "LinkedIn",
		tags: ["logistics", "platform"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 9],
			["applied", 6],
		],
		contacts: [recruiter("Rani Pratama", "Talent Partner", "rani.pratama@example.test")],
		follow: { days: -2, note: "Ask Rani for an update; it has been six days." },
		notes: [[6, "Applied with the product manager resume. No auto-reply received."]],
	},
	{
		company: "Fernhill Studio",
		role: "Senior Product Manager",
		location: "Remote (Indonesia)",
		salary: "USD 4,500–6,000 / month",
		source: "Job board",
		tags: ["remote", "design-tools"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 14],
			["applied", 12],
		],
		follow: { days: -5, note: "No reply after twelve days. Send a short follow-up." },
		notes: [[12, "Referral not available; applied cold."]],
	},
	{
		company: "Quillstone AI",
		role: "Product Manager, Applied AI",
		location: "Jakarta (hybrid)",
		salary: "IDR 60–75 million / month",
		source: "Recruiter",
		tags: ["ai", "priority"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 16],
			["applied", 13],
			["screening", 8],
		],
		contacts: [recruiter("Bima Santoso", "Senior Recruiter", "bima.santoso@example.test")],
		follow: { days: 2, note: "Bima said the hiring manager decides by Thursday." },
		notes: [
			[8, "Intro call booked with Bima; he outlined a three-round process."],
			[3, "Sent the case study follow-up he asked for."],
		],
	},
	{
		key: "northstar",
		company: "Northstar Labs",
		role: "Senior Product Manager",
		location: "Jakarta (hybrid, 2 office days)",
		salary: "IDR 55–70 million / month",
		source: "LinkedIn",
		sourceUrl: "https://careers.example.com/northstar/senior-product-manager",
		tags: ["product", "priority", "onboarding"],
		resume: "Alex Demo - Product Manager",
		letter: "Cover letter - Northstar Labs",
		path: [
			["saved", 21],
			["applied", 18],
			["screening", 12],
			["interview", 7],
		],
		jobDescription:
			"Lead onboarding and activation for the Northstar workflow platform. Partner with design and data to run weekly experiments and report to the head of product.",
		requirements: [
			"6+ years of product management in B2B SaaS",
			"Track record on activation or onboarding metrics",
			"Comfortable with experiments and SQL",
			"Clear written communication",
		],
		contacts: [
			recruiter("Dewi Anggraini", "Talent Partner", "dewi.anggraini@example.test"),
			{
				name: "Raka Wijaya",
				role: "Head of Product",
				type: "Hiring Manager",
				email: "raka.wijaya@example.test",
				phone: "",
			},
		],
		follow: { days: 1, note: "Send thank-you note after the behavioural round." },
		notes: [
			[12, "Screening call with Dewi went well. She flagged the onboarding focus."],
			[5, "Technical round with Raka and an engineer: product sense case on trial-to-paid."],
			[2, "Dewi confirmed the behavioural round for tomorrow afternoon."],
		],
		interviews: [
			{
				key: "technical",
				days: -5,
				hour: 10,
				kind: "technical",
				duration: 75,
				location: "Video call (link sent by email)",
				audience: "hiring-manager",
				notes: "Case on improving trial-to-paid. They liked the funnel framing; asked about instrumentation.",
				participants: [participant("Raka Wijaya", "Head of Product"), participant("Sinta Hartono", "Staff Engineer")],
			},
			{
				key: "behavioral",
				days: 1,
				hour: 14,
				kind: "behavioral",
				duration: 60,
				location: "Northstar Labs, Jakarta office (Floor 12)",
				audience: "panel",
				notes: "Prepare two stories: a launch that went wrong, and a stakeholder disagreement.",
				participants: [participant("Raka Wijaya", "Head of Product"), participant("Maya Putri", "Design Lead")],
			},
		],
	},
	{
		key: "orbital",
		company: "Orbital",
		role: "Principal Product Manager",
		location: "Singapore (hybrid)",
		salary: "SGD 11,000–14,000 / month",
		source: "Former colleague",
		tags: ["product", "relocation"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 25],
			["applied", 22],
			["screening", 17],
			["interview", 10],
		],
		contacts: [
			{
				name: "Jun Wei Tan",
				role: "VP Product",
				type: "Referral",
				email: "junwei.tan@example.test",
				phone: "",
			},
		],
		follow: { days: 6, note: "Check relocation support details before the final round." },
		notes: [[10, "Two rounds done. Final onsite is scheduled for next week; relocation package still unclear."]],
		interviews: [
			{
				key: "onsite",
				days: 6,
				hour: 9,
				minute: 30,
				kind: "onsite",
				duration: 240,
				location: "Orbital HQ, Singapore (one-north)",
				audience: "panel",
				timezone: "Asia/Singapore",
				notes: "Half day: roadmap presentation, two interviews, lunch with the team.",
				participants: [
					participant("Jun Wei Tan", "VP Product"),
					participant("Priya Nair", "Director of Engineering"),
					participant("Lena Fischer", "Head of Design"),
				],
			},
		],
	},
	{
		key: "meridian",
		company: "Meridian Pay",
		role: "Staff Product Manager",
		location: "Jakarta (hybrid)",
		salary: "IDR 80–95 million / month",
		source: "Recruiter",
		tags: ["fintech", "offer"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 40],
			["applied", 37],
			["screening", 32],
			["interview", 24],
			["offer", 4],
		],
		contacts: [recruiter("Citra Lestari", "Head of Talent", "citra.lestari@example.test")],
		follow: { days: 3, note: "Reply to Citra with questions on equity and the review cycle." },
		notes: [[4, "Verbal offer by phone, written offer by email the next day. Decision due in a week."]],
		offer: {
			title: "Offer: Meridian Pay",
			base: 88_000_000,
			variable: 10_560_000,
			conditions: "Annual bonus up to 1.5 months, depending on company performance",
			equity: "0.08% options, four-year vesting, one-year cliff",
			location: "Jakarta",
			officeDays: 3,
			leave: "20 days + public holidays",
			learning: 25_000_000,
			other: "Private health insurance for family",
			respondInDays: 5,
			currency: "IDR",
			period: "month",
			daysAgo: 3,
		},
	},
	{
		key: "canopy",
		company: "Canopy Software",
		role: "Senior Product Manager",
		location: "Remote (Southeast Asia)",
		salary: "USD 5,500–7,000 / month",
		source: "Company website",
		tags: ["remote", "offer", "saas"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 35],
			["applied", 33],
			["screening", 28],
			["interview", 20],
			["offer", 2],
		],
		contacts: [recruiter("Owen Mitchell", "Recruiting Lead", "owen.mitchell@example.test")],
		follow: { days: 4, note: "Ask Owen whether the start date can move to January." },
		notes: [[2, "Written offer received. Fully remote, USD paid monthly through an employer of record."]],
		offer: {
			title: "Offer: Canopy Software",
			base: 6_200,
			variable: null,
			conditions: "",
			equity: "0.12% options, four-year vesting, one-year cliff",
			location: "Remote (Southeast Asia)",
			officeDays: 0,
			leave: "25 days",
			learning: 1_500,
			other: "Home-office allowance of USD 800",
			respondInDays: 8,
			currency: "USD",
			period: "month",
			daysAgo: 2,
		},
	},
	{
		company: "Brightpath Health",
		role: "Senior Product Manager",
		location: "Jakarta (on-site)",
		salary: "IDR 52–64 million / month",
		source: "LinkedIn",
		tags: ["health"],
		resume: "Alex Demo - Product Manager",
		path: [
			["saved", 50],
			["applied", 47],
			["screening", 41],
			["interview", 33],
			["closed", 20],
		],
		closedReason: "not-selected",
		notes: [[20, "Rejected after the final round: they chose a candidate with clinical-product experience."]],
	},
	{
		company: "Harbor Analytics",
		role: "Product Manager, Data Platform",
		location: "Remote",
		salary: "USD 4,000–5,000 / month",
		source: "Job board",
		tags: ["data", "remote"],
		path: [
			["saved", 30],
			["applied", 28],
			["screening", 22],
			["closed", 15],
		],
		closedReason: "withdrew",
		notes: [[15, "Withdrew after learning the role needs 4 office days in another city."]],
	},
];

// --- Career knowledge ------------------------------------------------------------------------------------------

const FACTS = [
	[
		"accomplishment",
		"Raised week-one activation from 31% to 47% at Northstar Labs through guided setup and templates.",
	],
	["accomplishment", "Shipped a usage-based billing module at Orbital that brought in USD 2.4M in its first year."],
	["experience", "Eight years of product management across B2B SaaS, fintech and consumer apps."],
	["experience", "Leads a squad of nine people across design, engineering and data."],
	["skill", "Writes SQL daily, including window functions, and designs A/B tests with power analysis."],
	[
		"skill",
		"Runs customer discovery: about ten structured interviews per quarter, synthesised into opportunity trees.",
	],
	["preference", "Prefers product teams that run weekly experiments and share a single roadmap."],
	["preference", "Wants at most three office days a week and a clear learning budget."],
];

const STORIES = [
	{
		title: "Fixing onboarding at Northstar Labs",
		situation:
			"Only 31% of new teams reached the first shared workflow in their first week, and trial conversion was flat.",
		task: "As the new owner of onboarding I had one quarter to raise activation without adding headcount.",
		action:
			"I interviewed 18 recent sign-ups, mapped where they stalled, and launched role-based templates and a three-step guided setup. I measured each change in a separate experiment and killed two ideas that did not move the metric.",
		result: "Week-one activation rose to 47% and trial-to-paid conversion improved by 5 points within two quarters.",
		reflection: "I would involve customer support earlier; they already knew the three biggest stumbling blocks.",
		tags: ["onboarding", "experimentation"],
		facts: [0, 5],
	},
	{
		title: "Launching usage-based billing at Orbital",
		situation:
			"Large customers complained that flat plans penalised light users, and sales were losing deals to metered competitors.",
		task: "Design and ship a usage-based billing module in six months with finance and engineering aligned on invoicing.",
		action:
			"I ran a pricing study with 12 customers, defined the metering events with engineering, and pre-agreed invoice formats with finance. We piloted with five accounts before the general release.",
		result: "The module brought in USD 2.4M in its first year and support tickets about invoices dropped by 28%.",
		reflection: "A pilot with fewer accounts would have found the proration bug two weeks sooner.",
		tags: ["pricing", "launch"],
		facts: [1],
	},
	{
		title: "Resolving a roadmap disagreement with engineering",
		situation: "Engineering wanted to spend a quarter on a platform migration; sales wanted three customer features.",
		task: "Agree a plan the VP of Product and the CTO could both defend.",
		action:
			"I quantified the cost of delay for each option, split the migration into three increments, and proposed pairing each increment with one customer feature. I walked both sides through the numbers before the planning meeting.",
		result: "Both sides signed off. The migration finished one sprint early and two of the three features shipped.",
		reflection: "Sharing the numbers privately first removed the defensiveness from the meeting.",
		tags: ["stakeholders", "roadmap"],
		facts: [3],
	},
];

const OFFERS_ORDER = ["meridian", "canopy"];

// --- Steps -----------------------------------------------------------------------------------------------------

const counts = {};
const count = (kind, amount = 1) => {
	counts[kind] = (counts[kind] ?? 0) + amount;
};
const log = (message) => console.info(message);

async function ensureAccount() {
	const found = await pool.query(`select id from "user" where lower(email) = lower($1)`, [DEMO_EMAIL]);
	if (found.rows.length > 0) {
		log("Account already exists.");
	} else {
		const signUp = await authPost("sign-up/email", {
			name: DEMO_NAME,
			email: DEMO_EMAIL,
			password: DEMO_PASSWORD,
			username: DEMO_USERNAME,
			displayUsername: DEMO_USERNAME,
			callbackURL: "/dashboard",
		});
		if (!signUp.ok) {
			throw new Error(`Sign-up failed (${signUp.status}): ${JSON.stringify(signUp.body).slice(0, 300)}`);
		}
		log("Account created.");
	}

	const { rows } = await pool.query(`select id from "user" where lower(email) = lower($1)`, [DEMO_EMAIL]);
	const row = rows[0];
	if (!row) throw new Error("The demo account was not found in the database the seed is pointed at.");
	await pool.query(`update "user" set email_verified = true, role = 'admin', timezone = $2 where id = $1`, [
		row.id,
		DEMO_TIMEZONE,
	]);

	jar.clear();
	const signIn = await authPost("sign-in/email", { email: DEMO_EMAIL, password: DEMO_PASSWORD });
	if (!signIn.ok) {
		throw new Error(
			`Sign-in failed (${signIn.status}). If the account existed before this script, its password differs from DEMO_PASSWORD.`,
		);
	}
	return row.id;
}

async function ensurePlan() {
	let summary = await rpc("billing/summary");
	const hasPlan =
		summary.planId === "pro-ai" &&
		summary.currentPeriodEndsAt &&
		new Date(summary.currentPeriodEndsAt).getTime() > Date.now() + 7 * DAY;
	if (!hasPlan) {
		await rpc("billing/admin/grantPeriod", {
			email: DEMO_EMAIL,
			planId: "pro-ai",
			days: 30,
			reason: "Demo data: show a paid plan in Settings",
		});
		count("plan grants");
	}
	summary = await rpc("billing/summary");
	if (summary.credits && summary.credits.balance < 100) {
		await rpc("billing/admin/adjustCredits", {
			email: DEMO_EMAIL,
			amount: 600,
			expiresInDays: 30,
			reason: "Demo data: AI credits to browse",
		});
		count("credit grants");
		summary = await rpc("billing/summary");
	}
	log(`Plan: ${summary.planId}, credits: ${summary.credits?.balance ?? "n/a"}.`);
}

async function allDocuments() {
	const [live, trashed] = await Promise.all([
		rpc("documents/list", { trashed: false }),
		rpc("documents/list", { trashed: true }),
	]);
	return { live, trashed };
}

/** Finds a document by name, live or in Trash; null when the demo account has none. */
function findDocument(documents, type, name) {
	const match = (list) => list.find((document) => document.type === type && document.name === name);
	const live = match(documents.live);
	if (live) return { ...live, inTrash: false };
	const trashed = match(documents.trashed);
	return trashed ? { ...trashed, inTrash: true } : null;
}

async function seedResume(spec, documents) {
	let existing = findDocument(documents, "resume", spec.name);
	let id = existing?.id;
	if (!id) {
		id = await rpc("resume/create", {
			name: spec.name,
			tags: spec.tags,
			...(spec.slug ? { slug: spec.slug } : {}),
			withSampleData: false,
		});
		count("resumes");
	} else if (existing.inTrash) {
		await rpc("documents/restore", { type: "resume", id });
	}
	const current = await rpc("resume/getById", { id });
	if (current.isLocked) await rpc("resume/setLocked", { id, isLocked: false });
	await rpc("resume/update", {
		id,
		name: spec.name,
		tags: spec.tags,
		data: resumeData(current.data, spec),
		...(spec.isPublic
			? { isPublic: true, showDownloadButtons: true, showInSearchEngines: false, hideContactDetails: false }
			: {}),
	});
	if (spec.isPublic) {
		try {
			await rpc("resume/update", { id, isPrimary: true });
		} catch (error) {
			log(`Could not make the resume primary: ${error.message}`);
		}
	}
	if (spec.isLocked) await rpc("resume/setLocked", { id, isLocked: true });
	return id;
}

async function seedTrashedResume(documents) {
	const existing = findDocument(documents, "resume", TRASHED_RESUME.name);
	if (existing?.inTrash) return;
	const id = await seedResume(TRASHED_RESUME, documents);
	await rpc("documents/trash", { type: "resume", id });
	count("trashed documents");
}

async function seedLetter(spec, documents, resumeIds) {
	const existing = findDocument(documents, "letter", spec.name);
	const resumeId = spec.resume ? resumeIds.get(spec.resume) : undefined;
	let letter;
	if (existing) {
		if (existing.inTrash) await rpc("documents/restore", { type: "letter", id: existing.id });
		letter = await rpc("coverLetters/getById", { id: existing.id });
	} else {
		letter = await rpc("coverLetters/create", {
			name: spec.name,
			recipient: "",
			content: spec.content,
			layout: "structured",
			recipientName: spec.recipientName,
			recipientCompany: spec.recipientCompany,
			letterDate: dayOf(-1),
			greeting: spec.recipientName ? `Dear ${spec.recipientName},` : "Dear hiring manager,",
			signOff: `Kind regards,\n${DEMO_NAME}`,
			...(resumeId ? { resumeId } : {}),
		});
		count("cover letters");
	}
	if (existing && !existing.inTrash) {
		letter = await rpc("coverLetters/update", {
			id: letter.id,
			expectedRevision: letter.revision,
			content: spec.content,
			recipientName: spec.recipientName,
			recipientCompany: spec.recipientCompany,
		});
	}
	await rpc("documents/setTags", { type: "letter", id: letter.id, tags: spec.tags });
	return letter.id;
}

async function seedTrashedLetter(documents) {
	const existing = findDocument(documents, "letter", TRASHED_LETTER.name);
	if (existing?.inTrash) return;
	const id = await seedLetter(TRASHED_LETTER, documents, new Map());
	await rpc("documents/trash", { type: "letter", id });
	count("trashed documents");
}

async function resetApplications() {
	const existing = await rpc("applications/listSummary", {});
	const ids = existing.map((application) => application.id);
	for (let index = 0; index < ids.length; index += 100) {
		await rpc("applications/bulkDelete", { ids: ids.slice(index, index + 100) });
	}
	return ids.length;
}

async function seedApplications(resumeIds, letterIds) {
	const created = new Map();
	const interviews = new Map();
	for (const spec of APPLICATIONS) {
		const [[firstStage, firstDaysAgo], ...rest] = spec.path;
		const id = await rpc("applications/create", {
			company: spec.company,
			role: spec.role,
			location: spec.location,
			salary: spec.salary,
			source: spec.source,
			...(spec.sourceUrl ? { sourceUrl: spec.sourceUrl } : {}),
			tags: spec.tags,
			status: firstStage,
			stageEnteredAt: dayOf(-firstDaysAgo),
			...(spec.jobDescription ? { jobDescription: spec.jobDescription } : {}),
			requirements: spec.requirements ?? [],
			contacts: spec.contacts ?? [],
			...(spec.resume ? { resumeId: resumeIds.get(spec.resume) } : {}),
			...(spec.letter ? { coverLetterId: letterIds.get(spec.letter) } : {}),
		});
		count("applications");

		for (const [stage, daysAgo] of rest) {
			await rpc("applications/update", {
				id,
				status: stage,
				stageEnteredAt: dayOf(-daysAgo),
				...(stage === "closed" ? { closedReason: spec.closedReason } : {}),
			});
		}
		for (const [daysAgo, text] of spec.notes ?? []) {
			await rpc("applications/addNote", { id, text, date: dayOf(-daysAgo) });
			count("notes");
		}
		for (const interview of spec.interviews ?? []) {
			const interviewId = uuid();
			await rpc("applications/addInterview", {
				id,
				at: at(interview.days, interview.hour, interview.minute ?? 0).toISOString(),
				kind: interview.kind,
				durationMinutes: interview.duration,
				location: interview.location,
				notes: interview.notes,
				participants: interview.participants,
				audience: interview.audience,
				timezone: interview.timezone ?? DEMO_TIMEZONE,
			});
			const stored = await rpc("applications/getById", { id });
			const entry = stored.activity.filter((item) => item.type === "interview").at(-1);
			interviews.set(`${spec.key}:${interview.key}`, entry?.id ?? interviewId);
			count("interviews");
		}
		if (spec.follow) {
			await rpc("applications/update", {
				id,
				followUpAt: at(spec.follow.days, 9),
				followUpNote: spec.follow.note,
			});
		}
		created.set(spec.key ?? spec.company, id);
	}
	return { created, interviews };
}

async function linkDocuments(created, resumeIds, letterIds) {
	const northstar = created.get("northstar");
	const orbital = created.get("orbital");
	const links = [
		["letter", letterIds.get("Cover letter - Northstar Labs"), northstar],
		["letter", letterIds.get("Cover letter - General Product Roles"), null],
		["resume", resumeIds.get("Alex Demo - Data Analyst"), orbital],
	];
	for (const [type, id, applicationId] of links) {
		if (!id) continue;
		try {
			await rpc("documents/linkApplication", { type, id, applicationId });
		} catch (error) {
			log(`Could not link a ${type}: ${error.message}`);
		}
	}
}

async function seedKnowledge() {
	await rpc("career/saveProfile", {
		targetRoles: ["Senior Product Manager", "Principal Product Manager", "Group Product Manager"],
		locations: ["Jakarta", "Singapore", "Remote (Southeast Asia)"],
		priorities:
			"A product team that runs weekly experiments, a clear path to a director role, a manager who gives direct feedback, and at most three office days a week.",
		minBase: { amount: 55_000_000, currency: "IDR", period: "month" },
		maxOfficeDays: 3,
		noticeWeeks: 4,
		memoryMode: "ask",
	});
	count("career profiles");

	const existingFacts = await rpc("career/facts", { all: true });
	const factIds = [];
	for (const [category, text] of FACTS) {
		const found = existingFacts.find((fact) => fact.text === text);
		if (found) {
			factIds.push(found.id);
			continue;
		}
		const saved = await rpc("career/saveFact", {
			applicationId: null,
			text,
			category,
			source: { kind: "manual", id: "demo-seed", quote: text },
		});
		if (saved) {
			factIds.push(saved.id);
			count("facts");
		} else {
			factIds.push(undefined);
		}
	}

	const existingStories = await rpc("career/stories", {});
	for (const { facts, ...story } of STORIES) {
		const found = existingStories.find((item) => item.data.title === story.title);
		await rpc("career/saveStory", {
			...(found ? { id: found.id } : {}),
			applicationId: null,
			...story,
			factIds: facts.map((index) => factIds[index]).filter(Boolean),
		});
		if (!found) count("stories");
	}
}

async function seedSchedules(created, interviews) {
	for (const schedule of await rpc("career/schedules", {})) await rpc("career/deleteSchedule", { id: schedule.id });
	const northstar = created.get("northstar");
	const interviewId = interviews.get("northstar:behavioral");
	// Switched off: an unattended run could call an AI provider, and the seed never does.
	await rpc("career/saveSchedule", {
		applicationId: northstar,
		interviewId,
		kind: "prepare",
		lead: "2h",
		enabled: false,
		email: false,
		nextRunAt: at(1, 12),
		timezone: DEMO_TIMEZONE,
		locale: "en-US",
	});
	await rpc("career/saveSchedule", {
		applicationId: created.get("Tidewater Logistics"),
		kind: "follow-up",
		enabled: false,
		email: false,
		nextRunAt: at(1, 9),
		timezone: DEMO_TIMEZONE,
		locale: "en-US",
	});
	count("schedules", 2);
}

/** Offers, notifications, discovered roles and a coach conversation have no creation API; saved here for the demo user. */
async function seedSqlOnly(userId, created) {
	const client = await pool.connect();
	try {
		await client.query("begin");

		await client.query(`delete from "career_artifact" where user_id = $1 and data->>'kind' = 'offer'`, [userId]);
		for (const key of OFFERS_ORDER) {
			const spec = APPLICATIONS.find((application) => application.key === key);
			const offer = spec?.offer;
			const applicationId = created.get(key);
			if (!offer || !applicationId) continue;
			const data = {
				kind: "offer",
				version: "written",
				currency: offer.currency,
				period: offer.period,
				base: offer.base,
				variable: offer.variable,
				variableConditions: offer.conditions,
				equity: offer.equity,
				location: offer.location,
				officeDays: offer.officeDays,
				leave: offer.leave,
				learning: offer.learning,
				other: offer.other,
				respondBy: at(offer.respondInDays, 17).toISOString(),
			};
			const created_at = new Date(Date.now() - offer.daysAgo * DAY);
			await client.query(
				`insert into "career_artifact" (id, user_id, application_id, title, data, evidence, input_version, created_at, updated_at)
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
				[
					randomUUID(),
					userId,
					applicationId,
					offer.title,
					JSON.stringify(data),
					JSON.stringify({ factIds: [], storyIds: [] }),
					randomUUID(),
					created_at,
				],
			);
			count("offers");
		}

		await client.query(`delete from "career_notification" where user_id = $1 and key like 'demo-%'`, [userId]);
		const notices = [
			["demo-roles", null, { type: "opportunities", count: 3, query: "Senior product manager Jakarta" }, 6, true],
			[
				"demo-followup",
				created.get("Tidewater Logistics"),
				{ type: "followup", company: "Tidewater Logistics", role: "Product Manager, Platform" },
				5,
				true,
			],
			[
				"demo-briefing",
				created.get("northstar"),
				{ type: "briefing", company: "Northstar Labs", role: "Senior Product Manager" },
				2,
				true,
			],
			["demo-read", null, { type: "opportunities", count: 1, query: "Product manager remote" }, 30, false],
		];
		for (const [key, applicationId, notice, hours, unread] of notices) {
			await client.query(
				`insert into "career_notification" (id, user_id, application_id, key, notice, url, read_at, created_at, updated_at)
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
				[
					randomUUID(),
					userId,
					applicationId,
					key,
					JSON.stringify(notice),
					applicationId ? `/dashboard/applications/${applicationId}` : "/dashboard/career",
					unread ? null : hoursAgo(hours - 1),
					hoursAgo(hours),
				],
			);
			count("notifications");
		}

		const roles = [
			[
				"https://careers.example.com/lumen-bank/product-owner-digital-savings",
				"Digital Product Owner, Savings",
				"Lumen Bank",
				"Jakarta",
				"Own the retail savings journey with design, engineering and risk.",
			],
			[
				"https://careers.example.com/tidewater/product-manager-fleet",
				"Product Manager, Fleet Tools",
				"Tidewater Logistics",
				"Surabaya",
				"Build tools that help dispatchers plan routes across 400 vehicles.",
			],
			[
				"https://careers.example.com/fernhill/senior-pm-collaboration",
				"Senior PM, Collaboration",
				"Fernhill Studio",
				"Remote",
				"Lead the real-time collaboration roadmap for a design tool.",
			],
		];
		for (const [index, [url, role, company, location, snippet]] of roles.entries()) {
			await client.query(
				`insert into "career_opportunity" (id, user_id, url, role, company, location, snippet, description, first_seen_at, last_seen_at)
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
				 on conflict (user_id, url) do nothing`,
				[
					randomUUID(),
					userId,
					url,
					role,
					company,
					location,
					snippet,
					`${snippet}\n\nFlexible hours.`,
					hoursAgo(8 - index),
				],
			);
		}
		count("discovered roles", roles.length);

		const title = "Prepare for my Northstar behavioural round";
		await client.query(`delete from "agent_threads" where user_id = $1 and title = $2`, [userId, title]);
		const threadId = randomUUID();
		await client.query(
			`insert into "agent_threads" (id, user_id, scope, application_id, title, status, last_message_at, created_at, updated_at)
			 values ($1, $2, 'career', $3, $4, 'active', $5, $6, $5)`,
			[threadId, userId, created.get("northstar"), title, hoursAgo(3), hoursAgo(3.1)],
		);
		const messages = [
			["user", "What should I focus on for tomorrow's behavioural round at Northstar Labs?", hoursAgo(3.1)],
			[
				"assistant",
				"Lead with your onboarding story: the activation jump from 31% to 47% is exactly what their posting asks for.\n\nThen keep your roadmap-disagreement story ready for the stakeholder question. Be specific about the numbers you shared with engineering before the meeting.\n\n(Demo conversation: no AI provider was called.)",
				hoursAgo(3),
			],
		];
		for (const [index, [role, text, createdAt]] of messages.entries()) {
			await client.query(
				`insert into "agent_messages" (id, user_id, thread_id, role, status, sequence, ui_message, created_at, updated_at)
				 values ($1, $2, $3, $4, 'completed', $5, $6, $7, $7)`,
				[
					randomUUID(),
					userId,
					threadId,
					role,
					index + 1,
					JSON.stringify({ id: randomUUID(), role, parts: [{ type: "text", text }] }),
					createdAt,
				],
			);
		}
		count("coach conversations");

		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
	}
}

async function verify() {
	const [resumes, letters, applications, facts, stories, schedules, notifications, offers, counts_, plan, trash] =
		await Promise.all([
			rpc("resume/list", {}),
			rpc("coverLetters/list", { limit: 100 }),
			rpc("applications/list", {}),
			rpc("career/facts", { all: true }),
			rpc("career/stories", {}),
			rpc("career/schedules", {}),
			rpc("career/notifications", {}),
			rpc("career/savedItems", { kind: "offer" }),
			rpc("documents/counts"),
			rpc("billing/summary"),
			rpc("documents/list", { trashed: true }),
		]);
	const byStatus = {};
	for (const application of applications) byStatus[application.status] = (byStatus[application.status] ?? 0) + 1;
	log("State now:");
	log(
		`  resumes ${resumes.length}, letters ${letters.total}, in Trash ${trash.length} (counts: ${counts_.resume}/${counts_.letter}/${counts_.trash})`,
	);
	log(`  applications ${applications.length} ${JSON.stringify(byStatus)}`);
	log(
		`  facts ${facts.length}, stories ${stories.length}, schedules ${schedules.length}, notifications ${notifications.length}, offers ${offers.length}`,
	);
	log(`  plan ${plan.planId}, credits ${plan.credits?.balance ?? "n/a"}`);
}

async function main() {
	log(`Seeding ${DEMO_EMAIL} on ${BASE_URL}`);
	const userId = await ensureAccount();
	await ensurePlan();

	const documents = await allDocuments();
	const resumeIds = new Map();
	for (const spec of RESUMES) resumeIds.set(spec.name, await seedResume(spec, documents));
	await seedTrashedResume(documents);

	const letterIds = new Map();
	for (const spec of LETTERS) letterIds.set(spec.name, await seedLetter(spec, documents, resumeIds));
	await seedTrashedLetter(documents);

	const removed = await resetApplications();
	if (removed > 0) log(`Replaced ${removed} existing demo applications.`);
	const { created, interviews } = await seedApplications(resumeIds, letterIds);
	await linkDocuments(created, resumeIds, letterIds);
	await seedKnowledge();
	await seedSchedules(created, interviews);
	await seedSqlOnly(userId, created);

	log("Created this run:");
	for (const [kind, total] of Object.entries(counts)) log(`  ${kind}: ${total}`);
	await verify();
}

try {
	await main();
} finally {
	await pool.end();
}
