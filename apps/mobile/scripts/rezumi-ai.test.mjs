// Run: node apps/mobile/scripts/rezumi-ai.test.mjs
// Real oRPC client, consent and Rezumi AI rules; native dialogs, credentials and remote HTTP are boundary fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const mobile = new URL("../", import.meta.url);
const requireMobile = createRequire(new URL("package.json", mobile));
const requireServer = createRequire(new URL("../../server/package.json", import.meta.url));
const requireSchema = createRequire(new URL("../../../packages/schema/package.json", import.meta.url));
const { transformSync } = createRequire(requireServer.resolve("tsx"))("esbuild");
let platform = "android";
let dialog;
let sent = [];
let credits = { balance: 12 };
// Rezumi AI is the default: the server lists it first.
let providers = [
	{ id: "server-ai:fixture", label: "Rezumi AI", provider: "openai", model: "fixture", managed: true },
	{
		id: "own",
		label: "My key",
		provider: "openai",
		model: "mine",
		baseURL: "https://ai.fixture.test/v1",
		managed: false,
	},
].map((provider) => ({ enabled: true, testStatus: "success", ...provider }));
const plural = (count, forms) => (count === 1 ? forms.one : forms.other).replace("#", String(count));
const modules = {
	"@/auth/session": {
		getAccountScope: () => "fixture-account",
		getServer: () => "https://server.fixture.test",
		getCredentials: async () => ({ scope: "fixture-account", server: "https://server.fixture.test", accessToken: "x" }),
		recoverFromUnauthorized: async () => null,
		rejectCredentials: async () => {},
	},
	"@/features/billing/plan-alert": {
		showPlanAlertForError: () => false,
		canShowPlans: () => platform === "android",
	},
	"./plan-alert": { canShowPlans: () => platform === "android" },
	"@rezumi/utils/string": { generateId: () => `key-${sent.length}` },
	"@lingui/core/macro": { t: (parts, ...values) => String.raw({ raw: parts }, ...values), plural },
	"react-native": {
		Alert: {
			alert: (title, message, buttons) => {
				dialog = { title, message, buttons };
			},
		},
	},
	"expo/fetch": {
		fetch: async (url, init) => {
			const path = new URL(url).pathname;
			const value = path.includes("aiProviders/list")
				? providers
				: path.includes("billing/summary")
					? { credits }
					: path.includes("webAccess/status")
						? {}
						: path.includes("agent/threads/get")
							? { thread: { aiProviderId: "server-ai:fixture" } }
							: { id: "result" };
			if (!/aiProviders\/list|billing\/summary|webAccess\/status|agent\/threads\/get/.test(path))
				sent.push({ path, input: init?.body ? JSON.parse(new TextDecoder().decode(init.body)).json : undefined });
			return new Response(JSON.stringify({ json: value }), { headers: { "content-type": "application/json" } });
		},
	},
};
function load(path) {
	const filename = fileURLToPath(new URL(path, mobile));
	const code = transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs", target: "es2022" }).code;
	const module = { exports: {} };
	new Function("require", "module", "exports", code)(
		(name) => modules[name] ?? requireMobile(name),
		module,
		module.exports,
	);
	return module.exports;
}
// The real catalog, so costs here are the ones the apps show.
modules.zod = requireSchema("zod");
modules["@rezumi/schema/billing"] = load("../../packages/schema/src/billing/catalog.ts");
modules["@/features/billing/ai-source"] = load("src/features/billing/ai-source.ts");
modules["./ai-consent"] = load("src/api/ai-consent.ts");
const { client } = load("src/api/client.ts");

async function run(request, choose = 1) {
	dialog = null;
	sent = [];
	const result = request().then(
		() => null,
		(error) => error,
	);
	for (let step = 0; step < 200 && !dialog; step++) await new Promise((resolve) => setImmediate(resolve));
	assert.ok(dialog, "AI work asks first");
	const shown = dialog;
	shown.buttons[choose].onPress();
	return { error: await result, dialog: shown };
}

// Android: the confirmation names Rezumi AI's cost and balance before anything is sent, then sends a keyed request.
{
	const { error, dialog: shown } = await run(() => client.applications.ai.tailorResume({ id: "fictional" }));
	assert.equal(error, null);
	assert.equal(shown.title, "Use Rezumi AI?");
	assert.match(shown.message, /Rezumi AI: 5 credits, 12 credits left/);
	assert.deepEqual(
		sent.map((call) => call.input.aiSource),
		["rezumi"],
	);
	assert.ok(sent[0].input.idempotencyKey, "each Rezumi AI action has its own key");
}

// Declining sends nothing, so no credits can be taken.
{
	const { error } = await run(() => client.ai.improve({ line: "x", action: "verb" }), 0);
	assert.equal(error.name, "AbortError");
	assert.deepEqual(sent, []);
}

// A conversation that runs on Rezumi AI sends its replies as Rezumi AI work.
{
	const { error } = await run(() =>
		client.agent.messages.send({ threadId: "fictional", message: { id: "m", role: "user", parts: [] } }),
	);
	assert.equal(error, null);
	assert.equal(sent[0].input.aiSource, "rezumi");
}

// Voice never runs on Rezumi AI: the user's own connection, without a cost or a source field.
{
	const { dialog: shown } = await run(() => client.career.voice.speak({ providerId: "own", model: "mine", text: "x" }));
	assert.doesNotMatch(shown.message, /credits/);
	assert.match(shown.title, /My key/);
	assert.equal(sent[0].input.aiSource, undefined);
}

// A file attached in a Rezumi AI conversation goes to Rezumi AI, and the confirmation says so. Uploading costs nothing.
{
	const { error, dialog: shown } = await run(() =>
		client.agent.attachments.create({
			threadId: "fictional",
			filename: "cv.txt",
			data: "AA==",
			mediaType: "text/plain",
		}),
	);
	assert.equal(error, null);
	assert.match(shown.title, /Rezumi AI/);
	assert.doesNotMatch(shown.message, /credits/);
	assert.equal(sent[0].input.aiSource, undefined);
}

// Plans that can't be read don't block AI: the request goes without a source, so the server never takes credits.
{
	const summary = credits;
	credits = undefined;
	const failing = modules["expo/fetch"].fetch;
	modules["expo/fetch"].fetch = async (url, init) =>
		url.includes("billing/summary") ? new Response("down", { status: 503 }) : failing(url, init);
	const { error } = await run(() => client.ai.improve({ line: "x", action: "verb" }));
	assert.equal(error, null);
	assert.equal(sent[0].input.aiSource, undefined);
	modules["expo/fetch"].fetch = failing;
	credits = summary;
}

// iOS never offers or sends Rezumi AI: the same action goes to the user's own connection.
platform = "ios";
{
	const { error, dialog: shown } = await run(() => client.applications.ai.tailorResume({ id: "fictional" }));
	assert.equal(error, null);
	assert.match(shown.title, /My key/);
	assert.doesNotMatch(shown.message, /credits/);
	assert.deepEqual(
		sent.map((call) => call.input.aiSource),
		["own"],
	);
}

// Plans that don't apply (no credits): requests go out as they did before Rezumi AI, without a source.
platform = "android";
credits = null;
providers = providers.filter((provider) => provider.managed);
{
	const { dialog: shown } = await run(() => client.ai.improve({ line: "x", action: "verb" }));
	assert.doesNotMatch(shown.message, /credits/);
	assert.equal(sent[0].input.aiSource, undefined);
}
