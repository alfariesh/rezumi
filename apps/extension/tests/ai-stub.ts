import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

/**
 * A scripted OpenAI-compatible AI for the Phase 05 specs, at a fixed address the local test server's own AI points to
 * (AI_PROVIDER=openai-compatible, AI_BASE_URL=http://127.0.0.1:4319/v1, FLAG_ALLOW_UNSAFE_AI_BASE_URL=true; see
 * AGENTS.md). It answers "Read with AI" with fixed posting fields and the AI match score with a fixed score, so no real
 * AI runs and nothing is paid. Anything else gets "1" (the connection test).
 */
export const AI_STUB_PORT = 4319;

export const STUB_POSTING = {
	company: "Lumen Health",
	role: "Senior Product Designer",
	location: "Jakarta Selatan (Hybrid)",
	salary: "IDR 15.000.000 – 20.000.000 / month",
	requirements: ["Figma", "User research", "Design systems"],
};

export const STUB_SCORE = {
	score: 72,
	strengths: ["Designs in Figma", "Runs user research"],
	gaps: ["No healthcare experience yet"],
};

type ChatRequest = { messages: { role: string; content?: unknown }[] };

const text = (content: unknown) =>
	typeof content === "string"
		? content
		: Array.isArray(content)
			? content.map((part) => (part as { text?: string }).text ?? "").join("")
			: "";

function answerFor(request: ChatRequest) {
	const prompt = request.messages.map((message) => text(message.content)).join("\n");
	if (prompt.includes("Compare this resume against the job description")) return JSON.stringify(STUB_SCORE);
	if (prompt.includes("Read the posting and return JSON")) return JSON.stringify(STUB_POSTING);
	return "1";
}

function handle(request: IncomingMessage, response: ServerResponse, calls: string[]) {
	let body = "";
	request.on("data", (data) => {
		body += data;
	});
	request.on("end", () => {
		if (!request.url?.endsWith("/chat/completions")) {
			response.writeHead(404).end();
			return;
		}
		const content = answerFor(JSON.parse(body || "{}") as ChatRequest);
		calls.push(content === "1" ? "test" : content.includes('"score"') ? "score" : "posting");
		response.writeHead(200, { "content-type": "application/json" });
		response.end(
			JSON.stringify({
				id: "chatcmpl-stub",
				object: "chat.completion",
				created: 0,
				model: "stub",
				choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
				usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
			}),
		);
	});
}

/** Starts the stub; `calls` records what each request asked for ("posting", "score", "test"). */
export async function startAiStub() {
	const calls: string[] = [];
	const server = createServer((request, response) => handle(request, response, calls));
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(AI_STUB_PORT, "127.0.0.1", resolve);
	});
	return { calls, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
