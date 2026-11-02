import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const serverRequire = createRequire(new URL("../../server/package.json", import.meta.url));
const { transformSync } = createRequire(serverRequire.resolve("tsx"))("esbuild");
const tag = (parts, ...values) => parts.reduce((text, part, index) => text + part + (values[index] ?? ""), "");

class ORPCError extends Error {
	constructor(code, options = {}) {
		super(code);
		this.code = code;
		this.data = options.data;
	}
}

/** plan-alert.ts on one platform, with the alert it raises captured. */
function load(os) {
	const alerts = [];
	const module = { exports: {} };
	const code = transformSync(readFileSync(new URL("../src/features/billing/plan-alert.ts", import.meta.url), "utf8"), {
		loader: "ts",
		format: "cjs",
	}).code;
	const mocks = {
		"@lingui/core/macro": { t: tag },
		"@orpc/client": { ORPCError },
		"react-native": { Platform: { OS: os }, Alert: { alert: (title, message) => alerts.push({ title, message }) } },
		"@rezumi/schema/billing": { FREE_TEMPLATES: ["bronzor", "onyx", "rhyhorn", "azurill"] },
		"@/features/design/presets": { templateName: (id) => id.charAt(0).toUpperCase() + id.slice(1) },
	};
	new Function("require", "module", "exports", code)(
		(name) => {
			assert.ok(name in mocks, `Unexpected dependency: ${name}`);
			return mocks[name];
		},
		module,
		module.exports,
	);
	return { ...module.exports, alerts };
}

const refusals = [
	new ORPCError("PLAN_LIMIT_REACHED", {
		data: { limit: "activeResumes", max: 3, used: 3, requested: { resumes: 1, coverLetters: 0 } },
	}),
	...["premiumTemplates", "wordOdtExport", "customStyles", "customFonts", "automationApi"].map(
		(feature) => new ORPCError("PLAN_FEATURE_REQUIRED", { data: { feature } }),
	),
];

test("Android explains plan refusals and says where plans are sold, without a link, button or price", () => {
	const android = load("android");
	assert.equal(android.canShowPlans(), true);
	for (const error of refusals) assert.equal(android.showPlanAlertForError(error), true);
	for (const { title, message } of android.alerts) {
		assert.ok(message.endsWith("Plans can be bought on the rezumi.app website."));
		assert.doesNotMatch(`${title} ${message}`, /Rp|\d+\.\d{3}|https?:|\bbuy now\b|upgrade/i);
	}
	assert.match(android.alerts[0].message, /up to 3 resumes outside Trash/);
});

test("iOS explains plan refusals neutrally: no plans, prices or website", () => {
	const ios = load("ios");
	assert.equal(ios.canShowPlans(), false);
	for (const error of refusals) ios.showPlanAlertForError(error);
	assert.equal(ios.alerts.length, refusals.length);
	for (const { title, message } of ios.alerts)
		assert.doesNotMatch(`${title} ${message}`, /plan|Plus|Pro AI|rezumi\.app|Rp|bought|upgrade|https?:/i);
});

test("ignores errors that aren't plan refusals", () => {
	const android = load("android");
	assert.equal(android.showPlanAlertForError(new ORPCError("NOT_FOUND")), false);
	assert.equal(android.showPlanAlertForError(new Error("PLAN_LIMIT_REACHED")), false);
	assert.equal(android.alerts.length, 0);
});
