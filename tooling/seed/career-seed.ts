/**
 * Fills one local account with a fictional career search, so Today, Coach, Knowledge, Offers and the application
 * workspace have something to show, and the user guides' screenshots can be retaken: Alex Morgan, a product manager
 * in Berlin, interviewing at Northstar Labs and weighing offers from Brightpath and Canopy Systems.
 *
 *   pnpm seed:career --email you@example.test
 *
 * It replaces that account's applications and career data (facts, stories, saved results, schedules, notifications,
 * discovered roles) and refuses any database that isn't on this machine. Sign up through the app first, and use a
 * throwaway account: resumes and letters are left alone, but every application on it is deleted.
 */
import type { ApplicationStatus, ApplicationTimelineEntry, Contact } from "@rezumi/schema/applications/data";
import type { CareerProfileData, CareerWorkspace, SavedItemData } from "@rezumi/schema/career";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { PoolClient } from "pg";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { copyCoverLetterStyle } from "@rezumi/resume/cover-letter";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { generateId } from "@rezumi/utils/string";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const { values: args } = parseArgs({ options: { email: { type: "string" } } });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run through `pnpm seed:career`, which loads .env.local.");
if (!LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
	throw new Error("Refusing to seed: DATABASE_URL must point at a database on this machine.");
}
if (!args.email) throw new Error("Pass the account to fill: pnpm seed:career --email you@example.test");

const pool = new Pool({ connectionString: databaseUrl });

// Plain SQL through `pg`, as in dev-seed.ts: keys are the schema's camelCase names, columns their snake_case.
const JSONB_COLUMNS = new Set([
	"data",
	"source",
	"revisions",
	"evidence",
	"notice",
	"requirements",
	"contacts",
	"activity",
]);
const columnOf = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

async function insert(client: PoolClient, table: string, row: Record<string, unknown>) {
	const keys = Object.keys(row);
	const columns = keys.map((key) => `"${columnOf(key)}"`).join(", ");
	const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
	const values = keys.map((key) => (JSONB_COLUMNS.has(key) ? JSON.stringify(row[key]) : row[key]));
	await client.query(`insert into "${table}" (${columns}) values (${placeholders})`, values);
}

const account = (
	await pool.query<{ id: string; timezone: string }>(`select id, timezone from "user" where email = $1`, [args.email])
).rows[0];
if (!account) throw new Error(`No account for ${args.email}. Sign up in the app first.`);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY);
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000);

/** The wall-clock parts of an instant in the account's time zone. */
const partsIn = (instant: number) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: account.timezone,
		hourCycle: "h23",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	}).formatToParts(new Date(instant));
	const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
	return {
		year: part("year"),
		month: part("month"),
		day: part("day"),
		hour: part("hour"),
		minute: part("minute"),
		second: part("second"),
	};
};

/** `hour:minute` in the account's time zone, `days` from today (negative for the past), so times read naturally there. */
const at = (days: number, hour: number, minute = 0) => {
	const day = partsIn(now + days * DAY);
	const wall = Date.UTC(day.year, day.month - 1, day.day, hour, minute);
	const shown = partsIn(wall);
	const offset = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second) - wall;
	return new Date(wall - offset);
};

// --- Applications ----------------------------------------------------------------------------------------------

const posting = (company: string, role: string, lines: string[]) =>
	`${company} is hiring a ${role}.\n\nWhat you'll do\n${lines.map((line) => `- ${line}`).join("\n")}\n\nWhat we're looking for\n- 5+ years of product management in B2B SaaS\n- Cross-functional leadership across product, design and engineering\n- SQL and product analytics\n- Enterprise onboarding experience\n- A measured, staged approach to experimentation`;

const stage = (status: ApplicationStatus, daysBack: number): ApplicationTimelineEntry => ({
	id: generateId(),
	type: "stage",
	stage: status,
	at: daysAgo(daysBack),
});

const interviewIds = { screening: generateId(), behavioral: generateId(), brightpath: generateId() };

const contacts: Contact[] = [
	{
		name: "Maya Chen",
		role: "Head of Product",
		type: "Hiring Manager",
		email: "maya.chen@northstar.example",
		phone: "",
	},
	{ name: "Leo Fischer", role: "Design Lead", type: "Other", email: "", phone: "" },
];

const northstarActivity: ApplicationTimelineEntry[] = [
	stage("saved", 14),
	stage("applied", 12),
	stage("screening", 10),
	{
		id: interviewIds.screening,
		type: "interview",
		at: at(-8, 11),
		kind: "screening",
		durationMinutes: 30,
		location: "Video call",
		notes: "Went well. Maya asked about onboarding experiments.",
		participants: [{ name: "Maya Chen", role: "Head of Product" }],
		audience: "hiring-manager",
		timezone: "Europe/Berlin",
	},
	stage("interview", 7),
	{
		id: interviewIds.behavioral,
		type: "interview",
		at: at(1, 10),
		kind: "behavioral",
		durationMinutes: 45,
		location: "Video call, link in invitation",
		notes:
			"Prepare an onboarding case study, one disagreement story, and two questions about success in the first 90 days.",
		participants: [
			{ name: "Maya Chen", role: "Head of Product" },
			{ name: "Leo Fischer", role: "Design Lead" },
		],
		audience: "panel",
		timezone: "Europe/Berlin",
	},
];

type ApplicationSeed = {
	key: string;
	company: string;
	role: string;
	status: ApplicationStatus;
	location: string;
	salary?: string;
	source?: string;
	appliedDaysAgo: number;
	notes?: string;
	contacts?: Contact[];
	activity: ApplicationTimelineEntry[];
	posting: string[];
	followUpInDays?: number;
	closedReason?: "not-selected";
	tags?: string[];
};

const applications: ApplicationSeed[] = [
	{
		key: "northstar",
		company: "Northstar Labs",
		role: "Senior Product Manager",
		status: "interview",
		location: "Berlin · Hybrid",
		salary: "€95k – €115k",
		source: "Referral",
		appliedDaysAgo: 12,
		notes:
			"Strong match for activation ownership. Hiring manager wants to discuss customer discovery, experiment design, and stakeholder alignment.",
		contacts,
		activity: northstarActivity,
		posting: [
			"Own onboarding and activation for our B2B workspace product",
			"Run customer discovery and turn it into a measured experiment roadmap",
			"Partner with design and engineering on a six-person squad",
		],
		followUpInDays: 3,
	},
	{
		key: "brightpath",
		company: "Brightpath",
		role: "Senior Product Manager",
		status: "offer",
		location: "Berlin · 2 office days",
		salary: "€108k",
		source: "Recruiter",
		appliedDaysAgo: 34,
		activity: [stage("saved", 36), stage("applied", 34), stage("interview", 20), stage("offer", 3)],
		posting: ["Lead the self-serve growth squad", "Own the activation funnel and its experiments"],
		tags: ["offer"],
	},
	{
		key: "canopy",
		company: "Canopy Systems",
		role: "Product Lead",
		status: "offer",
		location: "Remote within Europe",
		salary: "€101k",
		source: "Job board",
		appliedDaysAgo: 30,
		activity: [stage("saved", 32), stage("applied", 30), stage("interview", 18), stage("offer", 2)],
		posting: ["Lead a distributed product team", "Set the roadmap for the platform's admin experience"],
		tags: ["offer"],
	},
	{
		key: "tidewater",
		company: "Tidewater",
		role: "Product Manager, Onboarding",
		status: "applied",
		location: "Amsterdam",
		source: "Company site",
		appliedDaysAgo: 4,
		activity: [stage("saved", 5), stage("applied", 4)],
		posting: ["Improve first-week activation for new customers", "Work with data and design on experiments"],
	},
	{
		key: "quill",
		company: "Quill & Co",
		role: "Group Product Manager",
		status: "closed",
		closedReason: "not-selected",
		location: "London",
		source: "Job board",
		appliedDaysAgo: 45,
		activity: [stage("saved", 47), stage("applied", 45), stage("closed", 25)],
		posting: ["Manage three product managers", "Own the portfolio roadmap"],
	},
];

// --- Career data -----------------------------------------------------------------------------------------------

const profile: CareerProfileData = {
	targetRoles: ["Senior Product Manager", "Product Lead"],
	locations: ["Berlin", "Remote within Europe"],
	priorities:
		"Own a meaningful product area, work closely with design and engineering, and improve how customers get started.",
	minBase: { amount: 95000, currency: "EUR", period: "year" },
	maxOfficeDays: 2,
	noticeWeeks: 8,
	memoryMode: "auto",
};

type FactSeed = {
	text: string;
	category: "accomplishment" | "experience" | "skill" | "preference";
	source: { kind: "resume" | "user-message" | "manual" | "debrief"; quote: string };
	application?: string;
};

const facts: FactSeed[] = [
	{
		text: "Maya asked me to focus on experiment design and how I resolved trade-offs with engineering in the next round.",
		category: "experience",
		source: {
			kind: "debrief",
			quote: "She wants to hear how I resolved trade-offs with engineering, and how I design experiments.",
		},
		application: "northstar",
	},
	{
		text: "I want a role with product ownership, strong design collaboration, and measurable customer impact. I prefer Berlin or a remote team within Europe.",
		category: "preference",
		source: {
			kind: "user-message",
			quote: "I want product ownership, strong design collaboration and measurable customer impact.",
		},
	},
	{
		text: "I introduced a weekly customer-insight review with sales and support, turning repeated setup questions into a prioritised onboarding backlog.",
		category: "accomplishment",
		source: { kind: "resume", quote: "Introduced a weekly customer-insight review with sales and support." },
	},
	{
		text: "I use SQL and Amplitude to analyse funnels, design experiments, and review activation and retention with cross-functional teams.",
		category: "skill",
		source: { kind: "resume", quote: "SQL, Amplitude, experiment design, funnel analysis." },
	},
	{
		text: "I have six years of product management experience in B2B SaaS, including three years owning activation and onboarding at LumenWorks.",
		category: "experience",
		source: { kind: "resume", quote: "Product Manager, LumenWorks, 2021 to present." },
	},
	{
		text: "I interviewed 18 new customers, mapped the three largest onboarding drop-offs, and shipped a guided setup that lifted activation from 41% to 58% in two quarters.",
		category: "accomplishment",
		source: {
			kind: "user-message",
			quote: "We went from 41% to 58% activation in two quarters after the guided setup.",
		},
	},
	{
		text: "I led a six-person cross-functional team across product, design and engineering.",
		category: "experience",
		source: { kind: "manual", quote: "" },
	},
];

type StorySeed = {
	title: string;
	situation: string;
	task: string;
	action: string;
	result: string;
	reflection: string;
	tags: string[];
	facts: number[];
};

const stories: StorySeed[] = [
	{
		title: "Fixing the onboarding drop-off at LumenWorks",
		situation:
			"Fewer than half of new workspaces finished setup, and support was answering the same five questions every week.",
		task: "Find out why customers stalled and own the plan to raise activation without adding engineering headcount.",
		action:
			"I interviewed 18 new customers, mapped the three biggest drop-offs, and set up a weekly insight review with sales and support. Together with design I shipped a guided setup, then ran it as a staged experiment.",
		result: "Activation rose from 41% to 58% in two quarters, and setup tickets fell by a third.",
		reflection: "I'd bring support into discovery from the first week next time, not the third.",
		tags: ["activation", "customer discovery"],
		facts: [2, 4, 5],
	},
	{
		title: "Designing the guided-setup experiment",
		situation: "We didn't know whether the guided setup or the new pricing page was driving activation.",
		task: "Design a test that would tell us, without delaying the launch.",
		action:
			"I wrote a hypothesis, split new workspaces between the old and the guided flow behind a flag, and agreed the success metric with data and engineering before we shipped.",
		result: "The guided flow won by 17 points, and we rolled it out to everyone after two weeks.",
		reflection: "Agreeing the metric first kept the readout short and the decision clear.",
		tags: ["experimentation", "analytics"],
		facts: [3, 5],
	},
];

const opportunities = [
	{
		role: "Senior Product Manager",
		company: "Mosaic Cloud",
		location: "Berlin, DE",
		snippet: "Lead onboarding and product-led growth. Experience with customer discovery and experimentation.",
		url: "https://jobs.example.com/mosaic-cloud/senior-product-manager",
		foundHoursAgo: 14,
	},
	{
		role: "Product Lead, Activation",
		company: "Fieldwork",
		location: "Remote within Europe",
		snippet:
			"Own the new-customer journey for a B2B platform. Cross-functional leadership across design, engineering and sales.",
		url: "https://jobs.example.com/fieldwork/product-lead-activation",
		foundHoursAgo: 14,
	},
];

const discoveryQuery = "Senior product manager onboarding B2B SaaS Berlin remote Europe";

// --- Saved results for Northstar Labs --------------------------------------------------------------------------

const fit: SavedItemData = {
	kind: "fit",
	headline: "A relevant role, with one question to resolve",
	summary:
		"Each requirement from the posting, checked against your Knowledge. Missing evidence means your notes don't show it yet, not that you lack it.",
	requirements: [
		{
			text: "5+ years in B2B SaaS product management",
			origin: "posting",
			status: "supported",
			evidence: "Six years in B2B SaaS, including three years owning activation.",
			factIds: [],
		},
		{
			text: "Cross-functional leadership",
			origin: "posting",
			status: "supported",
			evidence: "Led a six-person team across product, design and engineering.",
			factIds: [],
		},
		{
			text: "SQL and product analytics",
			origin: "posting",
			status: "supported",
			evidence: "Uses SQL and Amplitude for funnel analysis and experiments.",
			factIds: [],
		},
		{
			text: "Enterprise onboarding",
			origin: "posting",
			status: "missing",
			evidence: "Your Knowledge doesn't say which customer segments you onboarded.",
			factIds: [],
		},
		{
			text: "Formal experimentation programme",
			origin: "inferred",
			status: "partial",
			evidence: "A measured, staged rollout. Experiment design and attribution aren't described yet.",
			factIds: [],
		},
	],
	checks: [
		{ label: "Salary", met: true, text: "The stated range clears your €95,000 minimum." },
		{
			label: "Office days",
			met: null,
			text: "Berlin hybrid fits your two-day limit. Confirm what the team actually does.",
		},
	],
	ask: {
		person: "Maya",
		text: "Which customer segments does this role own? It tells you whether enterprise onboarding matters, and gives you a good question for the interview.",
	},
};

const briefing: SavedItemData = {
	kind: "briefing",
	headline: "Show how you turn discovery into a measured roadmap",
	summary: "The panel wants experiment design and how you settle trade-offs with engineering.",
	plan: [
		{
			minutes: 10,
			title: "Rehearse the onboarding story",
			detail: "Lead with the 41% to 58% result, then the three drop-offs you found.",
			action: "story",
			storyId: "__story0__",
		},
		{
			minutes: 10,
			title: "Draft a story about a disagreement with engineering",
			detail: "Your Knowledge has no story for this yet, and Leo is likely to ask.",
			action: "draft-story",
			storyId: null,
		},
		{
			minutes: 10,
			title: "Practise the opening out loud",
			detail: "Say it once, then trim it to a minute.",
			action: "practise",
			storyId: null,
		},
	],
	questions: [
		{ text: "How do you decide which onboarding experiments to run first?", origin: "Maya" },
		{ text: "Tell us about a disagreement with engineering and how it ended.", origin: "Leo" },
		{ text: "What would your first 30 days look like here?", origin: "Panel" },
	],
	focus: "Customer discovery, experiment design, and trade-offs with engineering.",
	opening:
		"I've spent three years owning activation at LumenWorks, turning customer interviews into a measured experiment roadmap. I'm here because Northstar treats onboarding as a product, not a checklist.",
	stories: ["Fixing the onboarding drop-off at LumenWorks", "Designing the guided-setup experiment"],
	honesty: "You haven't onboarded enterprise customers. Say so, and describe how you'd learn their needs.",
	storyIds: [],
	missingStory: "A disagreement with engineering and how you resolved it",
	practiceQuestions: [
		"Tell me about a time you used data to change a roadmap.",
		"How did you resolve a trade-off with engineering?",
	],
};

/** The briefing's plan and story list point at the stories just saved. */
const briefingFor = (storyIds: string[]): SavedItemData => {
	if (briefing.kind !== "briefing") return briefing;
	const [first] = storyIds;
	return {
		...briefing,
		storyIds: storyIds.slice(0, 2),
		plan: briefing.plan.map((step) => (step.storyId === "__story0__" ? { ...step, storyId: first ?? null } : step)),
	};
};

const practice: SavedItemData = {
	kind: "practice",
	question: "Tell me about a time you used data to change a roadmap.",
	origin: "simulated",
	mode: "typed",
	answer:
		"At LumenWorks, activation sat at 41%. I interviewed 18 new customers and mapped the three largest drop-offs. The data showed that setup, not pricing, was the problem, so I moved a planned reporting feature behind a guided setup. Activation rose to 58% in two quarters.",
	title: "Strong result, contribution unclear",
	works: "The result is specific, and the numbers make the story easy to follow.",
	strengthen: "Say what you personally did versus the team: who built the guided setup, and what did you decide?",
	opening:
		"Activation was stuck at 41%, so I went and talked to 18 new customers before changing anything on the roadmap.",
	note: "Contribution unclear",
};

const debrief: SavedItemData = {
	kind: "debrief",
	round: "Screening with Maya Chen",
	question: "How do you design an onboarding experiment?",
	answer:
		"I started with the drop-off we'd mapped, wrote a hypothesis, and shipped the first three steps behind a flag so we could compare against the old flow.",
	landed: "mixed",
	title: "A clear method, thin on trade-offs",
	verdicts: [
		{ tag: "supported", text: "The staged rollout matches your Knowledge: the guided setup shipped behind a flag." },
		{
			tag: "observation",
			text: "You didn't say how you weighed the cost of a longer experiment against the release date.",
		},
	],
	nextRound: "Expect Maya to ask how you resolved trade-offs with engineering, and to dig into experiment design.",
	priority: "Draft the engineering-disagreement story with the numbers you used.",
	remember: "Maya asked about experiment design and trade-offs with engineering in the next round.",
	plan: [
		{ day: "mon", minutes: 30, task: "Draft the engineering-disagreement story with the activation numbers" },
		{ day: "tue", minutes: 20, task: "Practise the experiment-design answer aloud" },
		{ day: "wed", minutes: 15, task: "Draft two questions about the first 90 days" },
	],
};

const reply: SavedItemData = {
	kind: "reply",
	message:
		"Hi Alex, thanks for the call yesterday. We'd like to set up a final conversation with Leo Fischer, our Design Lead. Could you share your availability for next week, and a short onboarding case study beforehand? We'll confirm the time once we hear from you. Best, Maya",
	title: "A final conversation, time not yet confirmed",
	asks: ["Share your availability for next week", "Send a short onboarding case study beforehand"],
	unconfirmed: ["The interview time", "How long the conversation lasts"],
	reply:
		"Hi Maya,\n\nThank you. I'm free on Tuesday and Thursday next week, mornings or after 15:00. I'll send a short onboarding case study by Wednesday evening. Could you tell me how long the conversation runs and who else will join?\n\nBest,\nAlex",
	changes: [{ type: "follow-up", at: at(2, 9).toISOString(), note: "Reply with availability for the final round" }],
	offer: null,
	applied: null,
};

const answerSeeds = [
	{
		question: "Why Northstar Labs?",
		answer:
			"Northstar treats onboarding as a product, not a side project. I've spent three years owning activation and I want to keep doing this where design and engineering share one goal.",
		facts: [4, 5],
	},
	{
		question: "Describe a time you used data to change a roadmap.",
		answer:
			"At LumenWorks I interviewed 18 new customers, mapped three drop-offs and shipped a guided setup behind a flag. Activation rose from 41% to 58% in two quarters, and I owned the roadmap.",
		facts: [2, 5],
	},
];

const answers: SavedItemData = {
	kind: "answers",
	answers: answerSeeds.map(({ question, answer }) => ({ question, answer })),
};

const offerBrightpath: SavedItemData = {
	kind: "offer",
	version: "written",
	currency: "EUR",
	period: "year",
	base: 108000,
	variable: 10800,
	variableConditions: "Depends on company and personal targets",
	equity: "Options; strike price and exercise window need clarifying",
	location: "Berlin",
	officeDays: 2,
	leave: "30 days",
	learning: 1500,
	other: "Pension contribution",
	respondBy: at(7, 17, 58).toISOString(),
};

const offerCanopy: SavedItemData = {
	kind: "offer",
	version: "written",
	currency: "EUR",
	period: "year",
	base: 101000,
	variable: null,
	variableConditions: "",
	equity: "0.12% options, four-year vesting, one-year cliff",
	location: "Remote within Europe",
	officeDays: 0,
	leave: "28 days",
	learning: 2000,
	other: "Home-office allowance",
	respondBy: at(9, 17, 58).toISOString(),
};

const workspace = (message: string, factIds: string[]): CareerWorkspace => ({
	answers: answerSeeds.map(({ question, answer, facts: backing }) => ({
		id: generateId(),
		question,
		answer,
		factIds: backing.map((index) => factIds[index]).filter((id): id is string => Boolean(id)),
	})),
	checklist: [0],
	questions: [
		{ text: "Which customer segments does this role own?", origin: "Fit" },
		{ text: "What does success look like in the first 90 days?", origin: "Maya" },
	],
	evidence: {},
	ticks: {},
	message,
});

// --- Documents sent to Northstar Labs --------------------------------------------------------------------------

const RESUME_SLUG = "alex-morgan-product-manager";
const LETTER_NAME = "Northstar Labs: Senior Product Manager";

const alexResume = (): ResumeData => {
	const data = structuredClone(sampleResumeData);
	data.basics = {
		...data.basics,
		name: "Alex Morgan",
		headline: "Senior Product Manager · Activation and Onboarding",
		email: "alex.morgan@example.com",
		location: "Berlin, Germany",
	};
	data.summary.content =
		"<p>Product manager with six years in B2B SaaS, three of them owning activation and onboarding. I turn customer interviews into measured experiments, and I work best next to design and engineering.</p>";
	return resumeDataSchema.parse(data) as ResumeData;
};

const letterContent =
	"<p>Northstar treats onboarding as a product, not a side project. For three years I have owned activation at LumenWorks, where a guided setup lifted activation from 41% to 58% in two quarters.</p><p>I would be glad to bring the same discipline, customer discovery first and measured experiments after, to your onboarding squad.</p>";

// --- Write -----------------------------------------------------------------------------------------------------

async function main() {
	// `main` is hoisted, so the narrowing above doesn't reach it.
	const user = account;
	if (!user) throw new Error(`No account for ${args.email}.`);
	const tx = await pool.connect();
	try {
		await tx.query("begin");
		// Applications cascade to most of the career tables, but facts and stories can also belong to no application.
		await tx.query(`delete from "agent_threads" where user_id = $1 and scope <> 'document'`, [user.id]);
		await tx.query(`update "application" set cover_letter_id = null where user_id = $1`, [user.id]);
		await tx.query(`delete from "cover_letter" where user_id = $1 and name = $2`, [user.id, LETTER_NAME]);
		await tx.query(`delete from "resume" where user_id = $1 and slug = $2`, [user.id, RESUME_SLUG]);
		for (const table of [
			"career_job",
			"career_notification",
			"career_schedule",
			"career_artifact",
			"career_story",
			"career_fact",
			"career_workspace",
			"career_opportunity",
			"career_transcript",
			"career_profile",
			"application",
		]) {
			await tx.query(`delete from "${table}" where user_id = $1`, [user.id]);
		}

		// A connection for the "sent to" lines. It carries no key, so nothing can be generated: the results are saved.
		const { rows: providers } = await tx.query<{ id: string }>(
			`select id from "ai_providers" where user_id = $1 order by is_default desc limit 1`,
			[user.id],
		);
		let providerId = providers[0]?.id ?? null;
		if (!providerId) {
			providerId = generateId();
			await insert(tx, "ai_providers", {
				id: providerId,
				userId: user.id,
				label: "DeepSeek",
				provider: "deepseek",
				model: "deepseek-chat",
				encryptedApiKey: "",
				apiKeySalt: "",
				apiKeyHash: "",
				apiKeyPreview: "",
				testStatus: "success",
				enabled: true,
				isDefault: true,
			});
		}
		// A second connection that can transcribe speech, so Practice offers audio files and names who transcribes.
		const { rows: speech } = await tx.query(`select 1 from "ai_providers" where user_id = $1 and provider = 'openai'`, [
			user.id,
		]);
		if (speech.length === 0) {
			await insert(tx, "ai_providers", {
				id: generateId(),
				userId: user.id,
				label: "OpenAI",
				provider: "openai",
				model: "gpt-5-mini",
				encryptedApiKey: "",
				apiKeySalt: "",
				apiKeyHash: "",
				apiKeyPreview: "",
				testStatus: "success",
				enabled: true,
				isDefault: false,
			});
		}

		await insert(tx, "career_profile", { userId: user.id, data: profile });

		const resumeId = generateId();
		const resumeData = alexResume();
		await insert(tx, "resume", {
			id: resumeId,
			userId: user.id,
			name: "Alex Morgan: Product Manager",
			slug: RESUME_SLUG,
			data: resumeData,
			createdAt: daysAgo(60),
			updatedAt: daysAgo(13),
		});
		const sentResumeVersionId = generateId();
		await insert(tx, "resume_version", {
			id: sentResumeVersionId,
			resumeId,
			userId: user.id,
			data: resumeData,
			kind: "sent",
			name: "Northstar Labs",
			createdAt: daysAgo(12),
		});

		const applicationIds = new Map<string, string>();
		for (const seed of applications) {
			// Stable per account, so links and screenshots survive a re-seed.
			const id = `career-${seed.key}-${user.id.slice(-8)}`;
			applicationIds.set(seed.key, id);
			await insert(tx, "application", {
				id,
				userId: user.id,
				company: seed.company,
				role: seed.role,
				location: seed.location,
				salary: seed.salary ?? null,
				status: seed.status,
				closedReason: seed.closedReason ?? null,
				source: seed.source ?? null,
				tags: seed.tags ?? [],
				sourceUrl: `https://jobs.example.com/${seed.key}`,
				jobDescription: posting(seed.company, seed.role, seed.posting),
				requirements: [
					"5+ years in B2B SaaS product management",
					"Cross-functional leadership",
					"SQL and product analytics",
					"Enterprise onboarding",
				],
				notes: seed.notes ?? null,
				followUpAt: seed.followUpInDays === undefined ? null : at(seed.followUpInDays, 9),
				followUpNote: seed.followUpInDays === undefined ? null : "Check in with Maya",
				contacts: seed.contacts ?? [],
				activity: seed.activity,
				appliedAt: daysAgo(seed.appliedDaysAgo),
				createdAt: daysAgo(seed.appliedDaysAgo + 2),
				updatedAt: daysAgo(Math.min(seed.appliedDaysAgo, 2)),
			});
		}
		const letterId = generateId();
		const letterStyle = copyCoverLetterStyle(resumeData);
		const letterFields = {
			recipient: "",
			content: letterContent,
			layout: "structured" as const,
			recipientName: "Maya Chen",
			recipientCompany: "Northstar Labs",
			letterDate: daysAgo(12).toISOString().slice(0, 10),
		};
		await insert(tx, "cover_letter", {
			id: letterId,
			userId: user.id,
			name: LETTER_NAME,
			...letterFields,
			style: letterStyle,
			sourceResumeId: resumeId,
			senderLinked: true,
			designLinked: true,
			createdAt: daysAgo(13),
			updatedAt: daysAgo(12),
		});
		const sentLetterVersionId = generateId();
		await insert(tx, "cover_letter_version", {
			id: sentLetterVersionId,
			coverLetterId: letterId,
			userId: user.id,
			data: { name: LETTER_NAME, ...letterFields, style: letterStyle },
			kind: "sent",
			name: "Northstar Labs",
			createdAt: daysAgo(12),
		});
		const northstar = applicationIds.get("northstar");
		const brightpath = applicationIds.get("brightpath");
		const canopy = applicationIds.get("canopy");
		if (!northstar || !brightpath || !canopy) throw new Error("Seed applications are missing.");
		await tx.query(
			`update "application" set resume_id = $1, sent_resume_version_id = $2, sent_check_score = 91,
				cover_letter_id = $3, sent_cover_letter_version_id = $4 where id = $5`,
			[resumeId, sentResumeVersionId, letterId, sentLetterVersionId, northstar],
		);
		await tx.query(`update "cover_letter" set source_application_id = $1 where id = $2`, [northstar, letterId]);

		const factIds: string[] = [];
		for (const [index, seed] of facts.entries()) {
			const id = generateId();
			factIds.push(id);
			await insert(tx, "career_fact", {
				id,
				userId: user.id,
				applicationId: seed.application ? (applicationIds.get(seed.application) ?? null) : null,
				text: seed.text,
				category: seed.category,
				source: { kind: seed.source.kind, id: generateId(), quote: seed.source.quote },
				sourceKey: `seed-${index}`,
				revisions: [],
				createdAt: daysAgo(10 - index),
			});
		}

		const storyIds: string[] = [];
		for (const [index, seed] of stories.entries()) {
			// Stable per account, so deep links and screenshots survive a re-seed.
			const id = `career-story-${index + 1}-${user.id.slice(-8)}`;
			storyIds.push(id);
			await insert(tx, "career_story", {
				id,
				userId: user.id,
				applicationId: null,
				data: {
					title: seed.title,
					situation: seed.situation,
					task: seed.task,
					action: seed.action,
					result: seed.result,
					reflection: seed.reflection,
					tags: seed.tags,
					factIds: seed.facts.map((index) => factIds[index]).filter(Boolean),
					applicationId: null,
				},
				createdAt: daysAgo(6),
			});
		}

		const artifact = (
			applicationId: string,
			title: string,
			data: SavedItemData,
			created: Date,
			interviewId: string | null = null,
			evidence = { factIds: [] as string[], storyIds: [] as string[] },
		) =>
			insert(tx, "career_artifact", {
				id: generateId(),
				userId: user.id,
				applicationId,
				interviewId,
				title,
				data,
				evidence,
				inputVersion: generateId(),
				createdAt: created,
				updatedAt: created,
			});

		const everything = { factIds, storyIds };
		await artifact(northstar, "Fit check", fit, hoursAgo(30), null, everything);
		await artifact(
			northstar,
			"Briefing: Behavioral interview",
			briefingFor(storyIds),
			hoursAgo(20),
			interviewIds.behavioral,
			everything,
		);
		await artifact(northstar, "Practice answer", practice, hoursAgo(10), interviewIds.behavioral, everything);
		await artifact(northstar, "Debrief: Screening", debrief, daysAgo(7), interviewIds.screening, everything);
		await artifact(northstar, "Reply to Maya", reply, hoursAgo(5));
		await artifact(northstar, "Application answers", answers, hoursAgo(40));
		await artifact(brightpath, "Offer: Brightpath", offerBrightpath, daysAgo(3));
		await artifact(canopy, "Offer: Canopy Systems", offerCanopy, daysAgo(2));

		await insert(tx, "career_workspace", {
			applicationId: northstar,
			userId: user.id,
			data: workspace(reply.kind === "reply" ? reply.message : "", factIds),
		});

		const discoveryId = generateId();
		const prepareId = generateId();
		const followUpId = generateId();
		const schedule = (row: Record<string, unknown>) =>
			insert(tx, "career_schedule", {
				userId: user.id,
				locale: "en-GB",
				timezone: user.timezone,
				email: false,
				...row,
			});
		await schedule({
			id: discoveryId,
			kind: "discovery",
			query: discoveryQuery,
			enabled: false,
			nextRunAt: at(1, 7, 30),
			lastQueuedAt: at(0, 7, 30),
			intervalDays: 1,
		});
		await schedule({
			id: prepareId,
			applicationId: northstar,
			interviewId: interviewIds.behavioral,
			kind: "prepare",
			lead: "2h",
			aiProviderId: providerId,
			enabled: false,
			nextRunAt: at(1, 8),
			intervalDays: null,
		});
		await schedule({
			id: followUpId,
			applicationId: northstar,
			kind: "follow-up",
			enabled: false,
			nextRunAt: at(3, 9),
			intervalDays: null,
		});

		for (const [index, row] of opportunities.entries()) {
			await insert(tx, "career_opportunity", {
				id: generateId(),
				userId: user.id,
				url: row.url,
				role: row.role,
				company: row.company,
				location: row.location,
				snippet: row.snippet,
				description: `${row.snippet}\n\nRemote-friendly, flexible hours.`,
				firstSeenAt: hoursAgo(row.foundHoursAgo - index),
				lastSeenAt: hoursAgo(row.foundHoursAgo - index),
			});
		}

		const notification = (key: string, notice: Record<string, unknown>, url: string | null, hours: number) =>
			insert(tx, "career_notification", {
				id: generateId(),
				userId: user.id,
				applicationId: notice.type === "opportunities" ? null : northstar,
				key,
				notice,
				url,
				createdAt: hoursAgo(hours),
				updatedAt: hoursAgo(hours),
			});
		await notification(
			"seed-roles",
			{ type: "opportunities", count: 2, query: discoveryQuery },
			"/dashboard/career",
			14,
		);
		await notification(
			"seed-follow-up",
			{ type: "followup", company: "Northstar Labs", role: "Senior Product Manager" },
			`/dashboard/applications/${northstar}/messages`,
			13,
		);
		await notification(
			"seed-briefing",
			{ type: "briefing", company: "Northstar Labs", role: "Senior Product Manager" },
			`/dashboard/applications/${northstar}/prepare`,
			12,
		);
		const thread = async (
			title: string,
			hoursBack: number,
			messages: { role: "user" | "assistant"; parts: Record<string, unknown>[] }[],
		) => {
			const id = generateId();
			await insert(tx, "agent_threads", {
				id,
				userId: user.id,
				aiProviderId: providerId,
				scope: "career",
				title,
				status: "active",
				lastMessageAt: hoursAgo(hoursBack),
				createdAt: hoursAgo(hoursBack + 0.1),
				updatedAt: hoursAgo(hoursBack),
			});
			for (const [index, message] of messages.entries()) {
				await insert(tx, "agent_messages", {
					id: generateId(),
					userId: user.id,
					threadId: id,
					role: message.role,
					status: "completed",
					sequence: index + 1,
					uiMessage: { id: generateId(), role: message.role, parts: message.parts },
					createdAt: hoursAgo(hoursBack),
				});
			}
		};
		await thread("Which opportunities match my priorities?", 40, [
			{
				role: "user",
				parts: [{ type: "text", text: "Which opportunities best match my priorities?" }],
			},
			{
				role: "assistant",
				parts: [
					{
						type: "text",
						text: "Two of your saved roles fit best. **Northstar Labs** gives you onboarding ownership, a design-led squad and a Berlin hybrid arrangement. **Tidewater** also centres on activation, but the posting doesn't say how many office days it expects.\n\nI relied on your preferences and the Northstar posting.",
					},
				],
			},
		]);
		const [firstStory] = stories;
		if (firstStory)
			await thread("Turn my onboarding result into a story", 2, [
				{
					role: "user",
					parts: [{ type: "text", text: "Help me turn the LumenWorks onboarding result into a story for Thursday." }],
				},
				{
					role: "assistant",
					parts: [
						{
							type: "text",
							text: "Here's a first version. Check the numbers, and I'll save it to Knowledge only if you approve.",
						},
						{
							type: "tool-save_story",
							state: "approval-requested",
							toolCallId: generateId(),
							approval: { id: generateId() },
							input: {
								title: firstStory.title,
								situation: firstStory.situation,
								task: firstStory.task,
								action: firstStory.action,
								result: firstStory.result,
								reflection: firstStory.reflection,
								factIds: [],
								tags: firstStory.tags,
							},
						},
					],
				},
			]);
		await tx.query("commit");
	} catch (error) {
		await tx.query("rollback");
		throw error;
	} finally {
		tx.release();
	}

	console.info(
		`Seeded ${args.email}: ${applications.length} applications, ${facts.length} facts, ${stories.length} stories, 2 offers, 3 schedules.`,
	);
}

try {
	await main();
} finally {
	await pool.end();
}
