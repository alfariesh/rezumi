import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

/*
 * Typography stays on one scale: the font families in packages/ui/src/styles/globals.css (`--font-sans`,
 * `--font-mono`) and HeroUI's text steps (`text-xs` … `text-6xl`, `font-medium`, `leading-relaxed`, Typography
 * `type`s). These rules fail the build when a one-off value slips back in. DESIGN.md → Typography has the scale.
 */

type Rule = { name: string; pattern: RegExp; hint: string };

const RULES: readonly Rule[] = [
	{
		name: "arbitrary text size",
		// Sizes start with a digit or a length function; `text-[oklch(…)]`, `text-[#555]` and `text-[color:…]` are colors.
		pattern: /(?<![\w-])(?:[\w-]+:)*text-\[(?:[\d.]|clamp\(|calc\(|min\(|max\()/,
		hint: "use text-xs, text-sm, text-base … or a HeroUI Typography type",
	},
	{
		name: "arbitrary line height",
		pattern: /(?<![\w-])(?:[\w-]+:)*leading-\[/,
		hint: "use leading-none … leading-loose, or a spacing step such as leading-5",
	},
	{
		name: "arbitrary letter spacing",
		pattern: /(?<![\w-])(?:[\w-]+:)*tracking-\[/,
		hint: "use tracking-tight … tracking-widest",
	},
	{
		name: "arbitrary font family or weight",
		pattern: /(?<![\w-])(?:[\w-]+:)*font-\[/,
		hint: "use font-sans or font-mono, and font-normal … font-bold",
	},
	{
		name: "retired font",
		pattern: /(?<![\w-])font-(?:ui|martian|anybody)(?![\w-])|Figtree|Geist/,
		hint: "the interface font is `font-sans` (Google Sans); mono is `font-mono` (Google Sans Code)",
	},
	{
		name: "literal font stack",
		pattern: /fontFamily:[^\n]*(?:sans-serif|monospace|system-ui)/,
		hint: "fall back to var(--font-sans) or var(--font-mono)",
	},
	{
		name: "hand-sized heading",
		pattern: /<h[1-3]\b[^>]*className="[^"]*(?<![\w-])text-(?:xl|[2-6]xl)(?![\w-])/,
		hint: 'use <Typography type="h2" render={renderAsH1}> (see libs/typography.tsx)',
	},
];

/** Every rule that matches in `source`, as "rule: line text". */
export function findViolations(source: string, rules: readonly Rule[] = RULES): string[] {
	return source
		.split("\n")
		.flatMap((line, index) =>
			rules.filter((rule) => rule.pattern.test(line)).map((rule) => `${rule.name} (line ${index + 1}): ${rule.hint}`),
		);
}

describe("typography rules", () => {
	it("flags the one-off values it exists to stop", () => {
		expect(findViolations('<p className="text-[13px] leading-[19px]">')).toHaveLength(2);
		expect(findViolations('<p className="md:text-[clamp(1rem,2vw,2rem)] tracking-[-.02em]">')).toHaveLength(2);
		expect(findViolations('<p className="font-martian font-[Inter]">')).toHaveLength(2);
		expect(findViolations('style={{ fontFamily: `"${font}", sans-serif` }}')).toHaveLength(1);
		expect(findViolations('<h2 className="text-xl font-semibold">')).toHaveLength(1);
	});

	it("allows the scale, colors and tokens", () => {
		for (const line of [
			'<p className="text-sm font-medium text-muted leading-relaxed tracking-tight">',
			'<p className="text-[#555] text-[oklch(0.3_0.01_95)] text-[color:var(--x)]">',
			'<p className="leading-(--cell) h-(--cell) font-sans font-mono">',
			'style={{ fontFamily: `"${font}", var(--font-sans)` }}',
			'<h2 className="text-sm font-semibold">',
			'<Typography type="h2" render={renderAsH1}>',
		])
			expect(findViolations(line)).toEqual([]);
	});
});

const SRC = fileURLToPath(new URL(".", import.meta.url));

// The landing page is illustration-bound marketing type (cqw, vw, clamp, em), scoped to `.landing` and documented in
// DESIGN.md → Marketing site. Its families still come from the tokens, so only the retired-font and stack rules apply.
const MARKETING = `features${sep}homepage${sep}`;
const MARKETING_RULES = RULES.filter((rule) => rule.name === "retired font" || rule.name === "literal font stack");

// A reflowed resume is document typography, drawn on white paper in the resume's own font, not interface type.
const DOCUMENT_HEADINGS = new Set([`features${sep}resume${sep}preview${sep}resume-reflow.tsx`]);

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(?:tsx?|css)$/.test(entry.name) && !/\.test\.|routeTree\.gen/.test(entry.name) ? [path] : [];
	});
}

describe("apps/web/src", () => {
	it("keeps every file on the typography scale", () => {
		const violations = sourceFiles(SRC).flatMap((file) => {
			const name = relative(SRC, file);
			let rules = name.startsWith(MARKETING) ? MARKETING_RULES : RULES;
			if (DOCUMENT_HEADINGS.has(name)) rules = rules.filter((rule) => rule.name !== "hand-sized heading");
			return findViolations(readFileSync(file, "utf8"), rules).map((violation) => `${name}: ${violation}`);
		});

		expect(violations).toEqual([]);
	});
});
