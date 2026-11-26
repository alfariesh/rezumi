import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { formatter } from "@lingui/format-po";

const root = new URL("../", import.meta.url);
const parse = (locale) => {
	const filename = `locales/${locale}.po`;
	return formatter().parse(readFileSync(new URL(filename, root), "utf8"), { locale, sourceLocale: "en-US", filename });
};

test("mobile copy keeps plan information read-only", async () => {
	const excluded = /\b(buy|bought|price|prices|upgrade|purchase|subscribe|checkout)\b/i;
	const exceptions = new Set([
		"What is the equity worth today: strike price, latest valuation, vesting and exercise window?",
	]);
	const messages = Object.values(await parse("en-US")).map(({ message }) => message ?? "");
	assert.deepEqual(
		messages.filter((message) => excluded.test(message) && !exceptions.has(message)),
		[],
	);

	const outboundBillingLink =
		/["'`](?:https?:\/\/[^"'`\s]+)?\/(?:dashboard\/settings\/billing|pricing|checkout)(?:[/?#"'`])/i;
	const code = ["app", "src/features", "src/ui", "src/shell"].flatMap((folder) => {
		const base = new URL(`${folder}/`, root);
		return readdirSync(base, { recursive: true })
			.filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
			.flatMap((name) =>
				outboundBillingLink.test(readFileSync(new URL(name, base), "utf8")) ? [`${folder}/${name}`] : [],
			);
	});
	assert.deepEqual(code, [], "Outbound billing links");
});

test("every mobile interface message has an Indonesian translation", async () => {
	const catalog = await parse("id-ID");
	assert.deepEqual(
		Object.values(catalog)
			.filter(({ translation }) => !translation)
			.map(({ message }) => message),
		[],
	);
});
