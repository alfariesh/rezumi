import type { JobFixture, Language, ResumeFixture } from "./fixtures";
/**
 * Measures what Rezumi AI costs and how well it does, per kind of work (membership phase 10). It drives a running
 * local server through the procedures the apps call, with `aiSource: "rezumi"`, on fictional resumes and postings
 * (fixtures/), then reads each run's tokens from `ai_credit_usage`.
 *
 *   pnpm benchmark:ai --url http://127.0.0.1:3051 --model claude-haiku-5-5 --budget-usd 10
 *
 * The server must run with BILLING_MODE=admins (or on) and its own AI (AI_PROVIDER, AI_MODEL, AI_API_KEY), and its
 * APP_URL must be `--url` so sign-up accepts the origin. Each run signs up a fresh account
 * (rezumi-ai-bench-…@example.test), makes it an admin, gives it Pro AI and credits through the admin procedures, and
 * writes its results to benchmark/results/<model>-<time>/. `--budget-usd` caps every benchmark run together: a task
 * starts only while what all benchmark accounts spent plus that task's worst case stays under it. It refuses any
 * database that isn't on this machine. Report: `pnpm benchmark:ai:report`.
 */
import type { RouterClient } from "@orpc/server";
import type router from "@rezumi/api/routers";
import type { CreditAction } from "@rezumi/schema/billing";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { Pool } from "pg";
import { CREDIT_COSTS } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { loadFixtures, toDocx, toPassages, toPdf, toPlainText, toResumeData } from "./fixtures";
import {
	BENCH_EMAIL_PREFIX,
	costMicros,
	detectLanguage,
	microsToUsd,
	MODEL_PRICES,
	newNumbers,
	placeholders,
	readable,
	wordCount,
} from "./stats";

type Client = RouterClient<typeof router>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const { values: args } = parseArgs({
	options: {
		url: { type: "string", default: "http://127.0.0.1:3051" },
		model: { type: "string" },
		"budget-usd": { type: "string" },
		only: { type: "string" },
	},
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run through `pnpm benchmark:ai`, which loads .env.local.");
if (!LOCAL_HOSTS.has(new URL(databaseUrl).hostname))
	throw new Error("Refusing to run: DATABASE_URL must point at a database on this machine.");
const model = args.model;
if (!model || !MODEL_PRICES[model])
	throw new Error(`Pass the server's AI_MODEL with --model: one of ${Object.keys(MODEL_PRICES).join(", ")}.`);
const budgetMicros = Math.round(Number(args["budget-usd"]) * 1_000_000);
if (!(budgetMicros > 0)) throw new Error("Pass the spending cap for all benchmark runs: --budget-usd 10");
const origin = new URL(args.url).origin;
const only = args.only ? new Set(args.only.split(",")) : null;

const pool = new Pool({ connectionString: databaseUrl });

// --- Budget -----------------------------------------------------------------------------------------------------

/** What every benchmark account has spent so far, priced from tokens at the long-context rate where it could apply. */
async function spentMicros(): Promise<number> {
	const { rows } = await pool.query<{
		model: string | null;
		input_tokens: number | null;
		output_tokens: number | null;
	}>(
		`select u.model, u.input_tokens, u.output_tokens from ai_credit_usage u join "user" a on a.id = u.user_id
		 where a.email like $1 and u.action <> 'admin-adjustment'`,
		[`${BENCH_EMAIL_PREFIX}%`],
	);
	return rows.reduce((sum, row) => {
		if (!row.model) return sum;
		const cost = costMicros(
			row.model,
			{ input: row.input_tokens ?? 0, output: row.output_tokens ?? 0 },
			{ upperBound: true },
		);
		if (cost === null) throw new Error(`No price for ${row.model}: add it to MODEL_PRICES before spending more.`);
		return sum + cost;
	}, 0);
}

// The most one task of each kind can cost: generous input, every output token AI_WORK_LIMITS allows, every agent step.
const WORST_CASE: Record<CreditAction, { input: number; output: number }> = {
	"short-text": { input: 30_000, output: 4_096 },
	"draft-answer": { input: 40_000, output: 4_096 },
	"cover-letter": { input: 40_000, output: 8_192 },
	"interview-practice": { input: 40_000, output: 8_192 },
	"coach-turn": { input: 8 * 60_000, output: 8 * 8_192 },
	review: { input: 50_000, output: 16_384 },
	"tailor-resume": { input: 50_000, output: 4_096 },
	"import-document": { input: 60_000, output: 32_768 },
	"portfolio-draft": { input: 40_000, output: 16_384 },
	"portfolio-rewrite": { input: 40_000, output: 16_384 },
	"portfolio-metrics": { input: 40_000, output: 8_192 },
};

// --- Session ----------------------------------------------------------------------------------------------------

async function auth(path: string, body: Record<string, string>) {
	const response = await fetch(`${origin}/api/auth/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", origin, referer: `${origin}/auth/login` },
		body: JSON.stringify(body),
		redirect: "manual",
	});
	if (!response.ok) throw new Error(`Auth ${path} failed (HTTP ${response.status}).`);
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

/** A fresh admin account on Pro AI with credits to spare. Its random password lives only in this process. */
async function createAccount(client: Client, setCookie: (cookie: string) => void) {
	const handle = `${model?.replace(/[^a-z0-9]/g, "")}${Date.now().toString(36)}`;
	const email = `${BENCH_EMAIL_PREFIX}${handle}@example.test`;
	const password = randomBytes(24).toString("base64url");
	await auth("sign-up/email", {
		name: "Benchmark Rezumi AI",
		email,
		password,
		username: `bench${handle}`.slice(0, 30),
		displayUsername: `bench${handle}`.slice(0, 30),
	});
	const { rows } = await pool.query<{ id: string }>(
		`update "user" set role = 'admin', email_verified = true where email = $1 returning id`,
		[email],
	);
	const userId = rows[0]?.id;
	if (!userId) throw new Error("The benchmark account wasn't created.");
	setCookie(await auth("sign-in/email", { email, password }));
	await client.billing.admin.grantPeriod({ userId, planId: "pro-ai", days: 30, reason: "Rezumi AI benchmark" });
	await client.billing.admin.adjustCredits({
		userId,
		amount: 3_000,
		expiresInDays: 30,
		reason: "Rezumi AI benchmark",
	});
	return { userId, email };
}

// --- Tasks ------------------------------------------------------------------------------------------------------

type Output = {
	/** What was asked, in a line, for the rating sheet. */
	input: string;
	/** The result as a person reads it. */
	text: string;
	/** Automatic checks: true is good, false is a problem, numbers are counts. */
	checks: Record<string, boolean | number | string | null>;
};

type Task = {
	id: string;
	action: CreditAction;
	procedure: string;
	language: Language;
	fixtures: string[];
	run: (key: string, signal: AbortSignal) => Promise<Output>;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const mentions = (text: string, value: string) => text.toLowerCase().includes(value.trim().toLowerCase());

const textChecks = (text: string, language: Language) => ({
	language: detectLanguage(text) === language,
	placeholders: placeholders(text).length,
	words: wordCount(text),
});

function buildTasks(context: {
	client: Client;
	fixtures: ReturnType<typeof loadFixtures>;
	applicationIds: Map<string, string>;
	mismatchIds: Map<string, string>;
	interviewIds: Map<string, string>;
	letterIds: Map<string, string>;
	threadIds: string[];
}): Task[] {
	const { client, fixtures, applicationIds, mismatchIds, interviewIds, letterIds, threadIds } = context;
	const resume = (id: string): ResumeFixture => {
		const found = fixtures.resumes.find((item) => item.id === id);
		if (!found) throw new Error(`No resume fixture ${id}.`);
		return found;
	};
	const job = (id: string): JobFixture => {
		const found = fixtures.jobs.find((item) => item.id === id);
		if (!found) throw new Error(`No job fixture ${id}.`);
		return found;
	};
	const resumeFor = (jobId: string) => resume(jobId.replace("job-", "cv-"));
	const app = (jobId: string) => {
		const id = applicationIds.get(jobId);
		if (!id) throw new Error(`No application for ${jobId}.`);
		return id;
	};
	const locale = (language: Language) => (language === "id" ? "id-ID" : "en-US");
	const rezumi = { aiSource: "rezumi" } as const;
	const tasks: Task[] = [];

	// short-text: one line rewritten, a posting read, fields filled from a paste.
	fixtures.tasks.improve.forEach((item, index) => {
		const source = resume(item.resume);
		const bullets = source.experience.find((entry) => item.where.includes(entry.company))?.bullets ?? [item.line];
		tasks.push({
			id: `improve-${index + 1}`,
			action: "short-text",
			procedure: "ai.improve",
			language: source.language,
			fixtures: [item.resume],
			run: async (key, signal) => {
				const result = await client.ai.improve(
					{
						line: item.line,
						action: item.action,
						...(item.request ? { request: item.request } : {}),
						where: item.where,
						context: bullets.join("\n"),
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				return {
					input: `${item.action}${item.request ? ` (${item.request})` : ""}: ${item.line}`,
					text: `${result.text}\n\n(why: ${result.why})`,
					checks: {
						changed: !same(result.text, item.line),
						shorter: item.action === "shorter" ? result.text.length < item.line.length : null,
						addsFacts: result.addsFacts,
						newNumbers: newNumbers(result.text, bullets.join(" ")).length,
						language: detectLanguage(result.text) !== (source.language === "id" ? "en" : "id"),
					},
				};
			},
		});
	});
	for (const jobId of ["job-01", "job-05", "job-08", "job-12", "job-18", "job-19"]) {
		const posting = job(jobId);
		tasks.push({
			id: `posting-${jobId}`,
			action: "short-text",
			procedure: "applications.ai.parsePosting",
			language: posting.language,
			fixtures: [jobId],
			run: async (key, signal) => {
				const result = await client.applications.ai.parsePosting(
					{ input: posting.description, ...rezumi, idempotencyKey: key },
					{ signal },
				);
				return {
					input: `Posting ${posting.role} at ${posting.company}`,
					text: readable({
						role: result.role,
						company: result.company,
						location: result.location,
						salary: result.salary,
						requirements: result.requirements,
					}),
					checks: {
						filledByAi: result.filledBy === "ai",
						company: mentions(result.company, posting.company) || mentions(posting.company, result.company),
						role: mentions(result.role, posting.role) || mentions(posting.role, result.role),
						requirements: result.requirements.length,
					},
				};
			},
		});
	}
	for (const jobId of ["job-03", "job-10", "job-15", "job-20"]) {
		const posting = job(jobId);
		tasks.push({
			id: `autofill-${jobId}`,
			action: "short-text",
			procedure: "applications.ai.autofill",
			language: posting.language,
			fixtures: [jobId],
			run: async (key, signal) => {
				const result = await client.applications.ai.autofill(
					{ jobDescription: posting.description.slice(0, 20_000), ...rezumi, idempotencyKey: key },
					{ signal },
				);
				return {
					input: `Autofill ${posting.role} at ${posting.company}`,
					text: readable(result),
					checks: {
						company: mentions(result.company, posting.company) || mentions(posting.company, result.company),
						role: mentions(result.role, posting.role) || mentions(posting.role, result.role),
					},
				};
			},
		});
	}

	// draft-answer: a follow-up to a recruiter, a reply to one, an application-form answer.
	for (const jobId of ["job-02", "job-07", "job-11", "job-14"]) {
		const posting = job(jobId);
		tasks.push({
			id: `followup-${jobId}`,
			action: "draft-answer",
			procedure: "applications.ai.draftMessage (follow-up)",
			language: posting.language,
			fixtures: [jobId, resumeFor(jobId).id],
			run: async (key, signal) => {
				const result = await client.applications.ai.draftMessage(
					{ id: app(jobId), kind: "follow-up", ...rezumi, idempotencyKey: key },
					{ signal },
				);
				return {
					input: `Follow-up for ${posting.role} at ${posting.company}`,
					text: result.text,
					checks: textChecks(result.text, posting.language),
				};
			},
		});
	}
	fixtures.tasks.recruiterMessages.forEach((item, index) => {
		const posting = job(item.job);
		tasks.push({
			id: `reply-${index + 1}`,
			action: "draft-answer",
			procedure: "career.generate (reply)",
			language: posting.language,
			fixtures: [item.job, resumeFor(item.job).id],
			run: async (key, signal) => {
				const result = await client.career.generate(
					{
						applicationId: app(item.job),
						locale: locale(posting.language),
						task: { task: "reply", message: item.message },
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = readable(result.item?.data ?? result.answer);
				return { input: `Reply to: ${item.message}`, text, checks: textChecks(text, posting.language) };
			},
		});
	});
	fixtures.tasks.formQuestions.forEach((item, index) => {
		const posting = job(item.job);
		tasks.push({
			id: `answer-${index + 1}`,
			action: "draft-answer",
			procedure: "career.generate (answer)",
			language: posting.language,
			fixtures: [item.job, resumeFor(item.job).id],
			run: async (key, signal) => {
				const result = await client.career.generate(
					{
						applicationId: app(item.job),
						locale: locale(posting.language),
						task: { task: "answer", question: item.question, answer: item.answer },
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = result.answer?.text ?? readable(result.item?.data);
				return {
					input: `${item.question}${item.answer ? ` (tighten: ${item.answer})` : ""}`,
					text,
					checks: {
						...textChecks(text, posting.language),
						shorter: item.answer ? wordCount(text) < wordCount(item.answer) : null,
					},
				};
			},
		});
	});

	// cover-letter: saved from an application, or streamed into a letter (and one revised shorter).
	for (const jobId of ["job-01", "job-06", "job-09", "job-17"]) {
		const posting = job(jobId);
		const source = resumeFor(jobId);
		tasks.push({
			id: `letter-app-${jobId}`,
			action: "cover-letter",
			procedure: "applications.ai.draftMessage (cover letter)",
			language: posting.language,
			fixtures: [jobId, source.id],
			run: async (key, signal) => {
				const result = await client.applications.ai.draftMessage(
					{ id: app(jobId), kind: "cover-letter", ...rezumi, idempotencyKey: key },
					{ signal },
				);
				return {
					input: `Cover letter: ${posting.role} at ${posting.company}`,
					text: result.text,
					checks: {
						...textChecks(result.text, posting.language),
						lengthAsked: wordCount(result.text) >= 200 && wordCount(result.text) <= 400,
						newNumbers: newNumbers(result.text, `${toPlainText(source)} ${posting.description}`).length,
						saved: Boolean(result.coverLetterId),
					},
				};
			},
		});
	}
	const drafts = new Map<string, string>();
	for (const jobId of ["job-04", "job-10", "job-13", "job-19", "job-20"]) {
		const posting = job(jobId);
		const source = resumeFor(jobId);
		tasks.push({
			id: `letter-draft-${jobId}`,
			action: "cover-letter",
			procedure: "coverLetters.draft",
			language: posting.language,
			fixtures: [jobId, source.id],
			run: async (key, signal) => {
				const letterId = letterIds.get(jobId);
				if (!letterId) throw new Error(`No letter for ${jobId}.`);
				let text = "";
				const stream = await client.coverLetters.draft(
					{ id: letterId, variant: "draft", ...rezumi, idempotencyKey: key },
					{ signal },
				);
				for await (const chunk of stream) text += chunk;
				drafts.set(jobId, text);
				return {
					input: `Letter draft: ${posting.role} at ${posting.company}`,
					text,
					checks: {
						...textChecks(text, posting.language),
						newNumbers: newNumbers(text, `${toPlainText(source)} ${posting.description}`).length,
					},
				};
			},
		});
	}
	tasks.push({
		id: "letter-shorter-job-13",
		action: "cover-letter",
		procedure: "coverLetters.draft (shorter)",
		language: job("job-13").language,
		fixtures: ["job-13", "cv-13"],
		run: async (key, signal) => {
			const previous = drafts.get("job-13");
			const letterId = letterIds.get("job-13");
			if (!previous || !letterId) throw new Error("The draft to shorten failed.");
			let text = "";
			const stream = await client.coverLetters.draft(
				{ id: letterId, variant: "shorter", previous, ...rezumi, idempotencyKey: key },
				{ signal },
			);
			for await (const chunk of stream) text += chunk;
			return {
				input: "Shorter: the job-13 draft",
				text,
				checks: { ...textChecks(text, "id"), shorter: wordCount(text) < wordCount(previous) },
			};
		},
	});

	// interview-practice: feedback on a typed answer, a debrief, a briefing for a scheduled interview.
	fixtures.tasks.practice.forEach((item, index) => {
		const posting = job(item.job);
		tasks.push({
			id: `practice-${index + 1}`,
			action: "interview-practice",
			procedure: "career.generate (practice)",
			language: posting.language,
			fixtures: [item.job, resumeFor(item.job).id],
			run: async (key, signal) => {
				const result = await client.career.generate(
					{
						applicationId: app(item.job),
						locale: locale(posting.language),
						task: {
							task: "practice",
							interviewId: null,
							question: item.question,
							origin: "simulated",
							mode: "typed",
							answer: item.answer,
						},
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = readable(result.item?.data);
				return { input: `Q: ${item.question}\nA: ${item.answer}`, text, checks: textChecks(text, posting.language) };
			},
		});
	});
	fixtures.tasks.debrief.forEach((item, index) => {
		const posting = job(item.job);
		tasks.push({
			id: `debrief-${index + 1}`,
			action: "interview-practice",
			procedure: "career.generate (debrief)",
			language: posting.language,
			fixtures: [item.job, resumeFor(item.job).id],
			run: async (key, signal) => {
				const result = await client.career.generate(
					{
						applicationId: app(item.job),
						locale: locale(posting.language),
						task: {
							task: "debrief",
							interviewId: null,
							question: item.question,
							answer: item.answer,
							landed: item.landed,
						},
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = readable(result.item?.data);
				return {
					input: `Debrief (${item.landed}) Q: ${item.question}\nA: ${item.answer}`,
					text,
					checks: textChecks(text, posting.language),
				};
			},
		});
	});
	for (const jobId of interviewIds.keys()) {
		const posting = job(jobId);
		tasks.push({
			id: `briefing-${jobId}`,
			action: "interview-practice",
			procedure: "career.generate (briefing)",
			language: posting.language,
			fixtures: [jobId, resumeFor(jobId).id],
			run: async (key, signal) => {
				const interviewId = interviewIds.get(jobId);
				if (!interviewId) throw new Error(`No interview for ${jobId}.`);
				const result = await client.career.generate(
					{
						applicationId: app(jobId),
						locale: locale(posting.language),
						task: { task: "briefing", interviewId },
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = readable(result.item?.data);
				return {
					input: `Briefing: ${posting.role} at ${posting.company}`,
					text,
					checks: textChecks(text, posting.language),
				};
			},
		});
	}

	// coach-turn: four conversations of three turns, two on a document (one long), two on an application.
	fixtures.tasks.coach.forEach((conversation, index) => {
		const language = conversation.resume ? resume(conversation.resume).language : job(conversation.job ?? "").language;
		conversation.turns.forEach((turn, turnIndex) => {
			tasks.push({
				id: `coach-${index + 1}-${turnIndex + 1}`,
				action: "coach-turn",
				procedure: `agent.messages.send (${conversation.scope})`,
				language,
				fixtures: [conversation.resume ?? conversation.job ?? ""],
				run: async (key, signal) => {
					const threadId = threadIds[index];
					if (!threadId) throw new Error("No conversation.");
					const stream = await client.agent.messages.send(
						{
							threadId,
							message: { id: generateId(), role: "user", parts: [{ type: "text", text: turn }] },
							...rezumi,
							idempotencyKey: key,
						},
						{ signal },
					);
					let streamed = 0;
					for await (const chunk of stream) streamed += chunk.length;
					const thread = await client.agent.threads.get({ id: threadId });
					const reply = thread.messages.at(-1);
					const text =
						reply?.role === "assistant"
							? reply.parts
									.map((part) => (part.type === "text" && "text" in part ? String(part.text) : ""))
									.join("")
									.trim()
							: "";
					const tools = reply?.parts.filter((part) => part.type.startsWith("tool-")).length ?? 0;
					return {
						input: turn,
						text,
						checks: { ...textChecks(text, language), replied: text.length > 0, tools, streamed },
					};
				},
			});
		});
	});

	// review: the ATS review (with and without a posting), match scores (good and poor fits), fit checks.
	for (const [cvId, jobId] of [
		["cv-05", "job-05"],
		["cv-11", "job-11"],
		["cv-13", "job-13"],
		["cv-18", "job-18"],
		["cv-19", "job-19"],
		["cv-03", null],
	] as const) {
		const source = resume(cvId);
		const posting = jobId ? job(jobId) : null;
		tasks.push({
			id: `ats-${cvId}`,
			action: "review",
			procedure: "ai.atsReview",
			language: source.language,
			fixtures: [cvId, ...(jobId ? [jobId] : [])],
			run: async (key, signal) => {
				const passages = toPassages(source);
				const result = await client.ai.atsReview(
					{
						extractedText: toPlainText(source),
						...(posting ? { jobDescription: posting.description.slice(0, 20_000) } : {}),
						passages,
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const rewrites = result.suggestions.filter((item) => item.rewrite);
				const text = readable(result);
				return {
					input: `ATS review of ${cvId}${posting ? ` for ${posting.role}` : ""}`,
					text,
					checks: {
						summary: result.summary.length > 0,
						suggestions: result.suggestions.length,
						knownPassages: rewrites.every(
							(item) => !item.passageId || passages.some((passage) => passage.id === item.passageId),
						),
						newNumbers: newNumbers(rewrites.map((item) => item.rewrite ?? "").join(" "), toPlainText(source)).length,
						language: detectLanguage(text) === source.language,
					},
				};
			},
		});
	}
	const matchPairs: { jobId: string; cvId: string; fit: "good" | "poor"; id: () => string }[] = [
		...["job-02", "job-07", "job-12", "job-15"].map((jobId) => ({
			jobId,
			cvId: resumeFor(jobId).id,
			fit: "good" as const,
			id: () => app(jobId),
		})),
		...[...mismatchIds.keys()].map((pair) => {
			const [jobId = "", cvId = ""] = pair.split("+");
			return {
				jobId,
				cvId,
				fit: "poor" as const,
				id: () => {
					const id = mismatchIds.get(pair);
					if (!id) throw new Error(`No application for ${pair}.`);
					return id;
				},
			};
		}),
	];
	for (const pair of matchPairs) {
		const posting = job(pair.jobId);
		tasks.push({
			id: `match-${pair.fit}-${pair.jobId}-${pair.cvId}`,
			action: "review",
			procedure: "applications.ai.matchScore",
			language: posting.language,
			fixtures: [pair.jobId, pair.cvId],
			run: async (key, signal) => {
				const result = await client.applications.ai.matchScore(
					{ id: pair.id(), ...rezumi, idempotencyKey: key },
					{ signal },
				);
				return {
					input: `Match ${pair.cvId} to ${posting.role} (${pair.fit} fit)`,
					text: readable(result),
					checks: { score: result.score, fit: pair.fit, gaps: result.gaps.length },
				};
			},
		});
	}
	for (const jobId of ["job-09", "job-14", "job-18"]) {
		const posting = job(jobId);
		tasks.push({
			id: `fit-${jobId}`,
			action: "review",
			procedure: "career.generate (fit)",
			language: posting.language,
			fixtures: [jobId, resumeFor(jobId).id],
			run: async (key, signal) => {
				const result = await client.career.generate(
					{
						applicationId: app(jobId),
						locale: locale(posting.language),
						task: { task: "fit" },
						...rezumi,
						idempotencyKey: key,
					},
					{ signal },
				);
				const text = readable(result.item?.data);
				return {
					input: `Fit check: ${posting.role} at ${posting.company}`,
					text,
					checks: textChecks(text, posting.language),
				};
			},
		});
	}

	// tailor-resume: last for its applications, since it relinks them to the tailored copy.
	for (const jobId of ["job-01", "job-03", "job-06", "job-08", "job-10", "job-13", "job-18", "job-19"]) {
		const posting = job(jobId);
		const source = resumeFor(jobId);
		tasks.push({
			id: `tailor-${jobId}`,
			action: "tailor-resume",
			procedure: "applications.ai.tailorResume",
			language: posting.language,
			fixtures: [jobId, source.id],
			run: async (key, signal) => {
				const result = await client.applications.ai.tailorResume(
					{ id: app(jobId), ...rezumi, idempotencyKey: key },
					{ signal },
				);
				const tailored = await client.resume.getById({ id: result.resumeId });
				const summary = tailored.data.summary.content;
				return {
					input: `Tailor ${source.id} for ${posting.role} at ${posting.company}\nOriginal summary: ${source.summary}`,
					text: summary.replace(/<[^>]+>/g, " ").trim(),
					checks: {
						html: summary.trim().startsWith("<p>"),
						changed: !mentions(summary, source.summary),
						newNumbers: newNumbers(summary, `${toPlainText(source)} ${posting.description}`).length,
						language: detectLanguage(summary) === source.language,
						words: wordCount(summary),
					},
				};
			},
		});
	}

	// import-document: the server's own PDF print and the web's Word export, read back into resume data.
	const imports: { cvId: string; kind: "pdf" | "docx" }[] = [
		{ cvId: "cv-02", kind: "pdf" },
		{ cvId: "cv-07", kind: "pdf" },
		{ cvId: "cv-10", kind: "pdf" },
		{ cvId: "cv-18", kind: "pdf" },
		{ cvId: "cv-19", kind: "pdf" },
		{ cvId: "cv-04", kind: "docx" },
		{ cvId: "cv-09", kind: "docx" },
		{ cvId: "cv-14", kind: "docx" },
		{ cvId: "cv-20", kind: "docx" },
	];
	for (const { cvId, kind } of imports) {
		const source = resume(cvId);
		tasks.push({
			id: `import-${kind}-${cvId}`,
			action: "import-document",
			procedure: kind === "pdf" ? "ai.parsePdf" : "ai.parseDocx",
			language: source.language,
			fixtures: [cvId],
			run: async (key, signal) => {
				const file = kind === "pdf" ? await toPdf(source) : await toDocx(source);
				const data =
					kind === "pdf"
						? await client.ai.parsePdf(
								{ file: { name: file.name, data: file.data }, ...rezumi, idempotencyKey: key },
								{ signal },
							)
						: await client.ai.parseDocx(
								{
									file: { name: file.name, data: file.data },
									mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
									...rezumi,
									idempotencyKey: key,
								},
								{ signal },
							);
				const companies = data.sections.experience.items.map((item) => item.company);
				const found = source.experience.filter((entry) =>
					companies.some((company) => mentions(company, entry.company)),
				);
				return {
					input: `Import ${cvId} (${kind}, ${Math.round(file.bytes / 1024)} KB)`,
					text: readable({
						name: data.basics.name,
						headline: data.basics.headline,
						email: data.basics.email,
						phone: data.basics.phone,
						experience: data.sections.experience.items.map(
							(item) => `${item.position} — ${item.company} (${item.period})`,
						),
						education: data.sections.education.items.map((item) => `${item.degree} ${item.area}, ${item.school}`),
					}),
					checks: {
						name: same(data.basics.name, source.name),
						email: same(data.basics.email, source.email),
						phone: data.basics.phone.replace(/\D/g, "") === source.phone.replace(/\D/g, ""),
						experience: `${found.length}/${source.experience.length}`,
						allExperience: found.length === source.experience.length,
						bytes: file.bytes,
					},
				};
			},
		});
	}

	return only ? tasks.filter((task) => only.has(task.action) || only.has(task.id)) : tasks;
}

// --- Run --------------------------------------------------------------------------------------------------------

type Usage = {
	status: string;
	model: string | null;
	input_tokens: number | null;
	output_tokens: number | null;
	cost_usd_micros: string | null;
	error_code: string | null;
	server_ms: number | null;
};

async function main() {
	const health = await fetch(`${origin}/api/health`).catch(() => null);
	if (!health?.ok) throw new Error(`No server at ${origin}: start it first (see this file's header).`);

	let cookie = "";
	// Headers are read per request, so the client picks up the session once the account signs in.
	const client: Client = createORPCClient(
		new RPCLink({ url: `${origin}/api/rpc`, headers: () => ({ cookie, "x-client-timezone": "Asia/Jakarta" }) }),
	);
	const fixtures = loadFixtures();
	const startedAt = new Date();
	const runDir = new URL(`results/${model}-${startedAt.toISOString().replace(/[:.]/g, "-")}/`, import.meta.url);
	mkdirSync(runDir, { recursive: true });

	const account = await createAccount(client, (value) => {
		cookie = value;
	});
	console.info(`Account ${account.email}; results in ${runDir.pathname}`);

	// The documents every task works on: each resume, an application per posting (linked to its resume), four
	// deliberately poor fits, two scheduled interviews, five letters and four conversations.
	const resumeIds = new Map<string, string>();
	for (const resume of fixtures.resumes)
		resumeIds.set(resume.id, await client.resume.import({ data: toResumeData(resume) }));
	const applicationIds = new Map<string, string>();
	const createApplication = (job: JobFixture, cvId: string) => {
		const resumeId = resumeIds.get(cvId);
		if (!resumeId) throw new Error(`No resume ${cvId}.`);
		return client.applications.create({
			company: job.company,
			role: job.role,
			location: job.location,
			salary: job.salary,
			jobDescription: job.description,
			resumeId,
		});
	};
	for (const job of fixtures.jobs)
		applicationIds.set(job.id, await createApplication(job, job.id.replace("job-", "cv-")));
	const mismatchIds = new Map<string, string>();
	for (const [jobId, cvId] of [
		["job-05", "cv-11"],
		["job-11", "cv-05"],
		["job-18", "cv-03"],
		["job-16", "cv-12"],
	] as const) {
		const job = fixtures.jobs.find((item) => item.id === jobId);
		if (job) mismatchIds.set(`${jobId}+${cvId}`, await createApplication(job, cvId));
	}
	const interviewIds = new Map<string, string>();
	for (const jobId of ["job-05", "job-16"]) {
		const id = applicationIds.get(jobId);
		if (!id) continue;
		const updated = await client.applications.addInterview({
			id,
			kind: "technical",
			at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
			timezone: "Asia/Jakarta",
		});
		const interview = updated.activity.findLast((entry) => entry.type === "interview");
		if (interview) interviewIds.set(jobId, interview.id);
	}
	const letterIds = new Map<string, string>();
	for (const jobId of ["job-04", "job-10", "job-13", "job-19", "job-20"]) {
		const applicationId = applicationIds.get(jobId);
		const resumeId = resumeIds.get(jobId.replace("job-", "cv-"));
		if (!applicationId || !resumeId) continue;
		const letter = await client.coverLetters.create({ name: `Benchmark ${jobId}`, resumeId, applicationId });
		letterIds.set(jobId, letter.id);
	}
	const threadIds: string[] = [];
	for (const conversation of fixtures.tasks.coach) {
		const thread =
			conversation.scope === "document"
				? await client.agent.threads.start({
						scope: "document",
						resumeId: resumeIds.get(conversation.resume ?? "") ?? "",
						aiSource: "rezumi",
					})
				: await client.agent.threads.start({
						scope: "application",
						applicationId: applicationIds.get(conversation.job ?? "") ?? "",
						aiSource: "rezumi",
					});
		threadIds.push(thread.id);
	}

	const tasks = buildTasks({
		client,
		fixtures,
		applicationIds,
		mismatchIds,
		interviewIds,
		letterIds,
		threadIds,
	});
	writeFileSync(
		new URL("run.json", runDir),
		JSON.stringify(
			{ model, origin, account: account.email, startedAt, budgetUsd: budgetMicros / 1e6, tasks: tasks.length },
			null,
			2,
		),
	);

	let spent = await spentMicros();
	console.info(`${tasks.length} tasks. Benchmark spend so far: $${microsToUsd(spent).toFixed(4)}.`);
	for (const [index, task] of tasks.entries()) {
		const worstCase = costMicros(model ?? "", WORST_CASE[task.action], { upperBound: true }) ?? 0;
		if (spent + worstCase > budgetMicros) {
			console.warn(`Stopping before ${task.id}: $${microsToUsd(spent).toFixed(4)} spent of the cap.`);
			break;
		}
		const key = `bench-${task.id}-${generateId()}`;
		const started = performance.now();
		let output: Output | null = null;
		let error: { code: string; message: string } | null = null;
		try {
			output = await task.run(key, AbortSignal.timeout(240_000));
		} catch (caught) {
			error =
				caught instanceof ORPCError
					? { code: String(caught.code), message: caught.message }
					: { code: caught instanceof Error ? caught.name : "error", message: String(caught) };
		}
		const ms = Math.round(performance.now() - started);
		const { rows } = await pool.query<Usage>(
			`select status, model, input_tokens, output_tokens, cost_usd_micros, error_code,
			   round(extract(epoch from (settled_at - created_at)) * 1000)::int as server_ms
			 from ai_credit_usage where operation_key = $1`,
			[`${account.userId}:${task.action}:${key}`],
		);
		const usage = rows[0] ?? null;
		if (usage?.model && usage.model !== model)
			throw new Error(`The server runs ${usage.model}, not ${model}: restart it or pass the right --model.`);
		const record = {
			id: task.id,
			action: task.action,
			credits: CREDIT_COSTS[task.action],
			procedure: task.procedure,
			language: task.language,
			fixtures: task.fixtures,
			ok: error === null,
			error,
			ms,
			usage,
			output,
		};
		appendFileSync(new URL("results.jsonl", runDir), `${JSON.stringify(record)}\n`);
		spent = await spentMicros();
		const tokens = usage ? `${usage.input_tokens ?? 0}/${usage.output_tokens ?? 0} tok` : "no usage";
		console.info(
			`[${index + 1}/${tasks.length}] ${task.id} ${error ? `FAILED ${error.code}` : "ok"} ${ms} ms, ${tokens}`,
		);
	}
	console.info(`Done. Benchmark spend: $${microsToUsd(spent).toFixed(4)} of $${(budgetMicros / 1e6).toFixed(2)}.`);
}

try {
	await main();
} finally {
	await pool.end();
}
