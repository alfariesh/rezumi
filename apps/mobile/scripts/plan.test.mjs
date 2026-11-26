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
		"@rezumi/schema/billing": { FREE_TEMPLATES: ["meridian", "sterling", "tunas", "wibawa", "kirana"] },
		"@rezumi/resume/design-presets": { templateName: (id) => id.charAt(0).toUpperCase() + id.slice(1) },
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
	...["premiumTemplates", "brandLogos", "wordOdtExport", "customStyles", "customFonts", "automationApi"].map(
		(feature) => new ORPCError("PLAN_FEATURE_REQUIRED", { data: { feature } }),
	),
];

test("iOS and Android explain plan refusals with the same neutral copy", () => {
	const android = load("android");
	const ios = load("ios");
	for (const error of refusals) {
		assert.equal(android.showPlanAlertForError(error), true);
		assert.equal(ios.showPlanAlertForError(error), true);
	}
	assert.deepEqual(android.alerts, ios.alerts);
	assert.equal(android.alerts.length, refusals.length);
	for (const { title, message } of android.alerts)
		assert.doesNotMatch(`${title} ${message}`, /Plus|Pro AI|rezumi\.app|\bbuy\b|bought|upgrade|https?:/i);
	assert.match(android.alerts[0].message, /up to 3 resumes outside Trash/);
});

test("ignores errors that aren't plan refusals", () => {
	const android = load("android");
	assert.equal(android.showPlanAlertForError(new ORPCError("NOT_FOUND")), false);
	assert.equal(android.showPlanAlertForError(new Error("PLAN_LIMIT_REACHED")), false);
	assert.equal(android.alerts.length, 0);
});
