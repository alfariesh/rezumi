import type { PortfolioView } from "../view";
import type { PortfolioHeroEffect, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { describe, expect, it } from "vite-plus/test";
import { parseAst } from "vite-plus";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_ACCENTS, PORTFOLIO_THEME_INFO, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { contrastRatio } from "@rezumi/utils/contrast";
import { testResume } from "../fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "../messages";
import { renderPortfolioPage } from "../page";
import { PORTFOLIO_PAGE_SCRIPT } from "../script";
import { THEME_PALETTES } from "../themes/palettes";
import { buildPortfolioView } from "../view";
import { gradientColors } from "./colors";
import { EFFECT_CSS } from "./css";
import { PREVIEW_STILL_CSS } from "./editor";
import { effectScript } from "./index";
import { EFFECT_RUNNERS } from "./runtime";

type Options = {
	theme?: PortfolioTheme;
	target?: "name" | "headline";
	phrases?: string[];
	headline?: string;
	/** Changes the view before it's drawn: what saved data can't say but a view might. */
	adjust?: (view: PortfolioView) => PortfolioView;
};

function render(effect: PortfolioHeroEffect, options: Options = {}) {
	const resume = testResume();
	if (options.headline !== undefined) resume.basics.headline = options.headline;
	const data = parseWritablePortfolioData({
		theme: options.theme ?? "lugas",
		hero: { effect: { id: effect, target: options.target ?? "name", phrases: options.phrases ?? [] } },
	});
	const messages = portfolioMessages("id-ID");
	const view = buildPortfolioView({
		portfolio: { data },
		resume: { data: resume },
		owner: { name: "Nadia", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `https://rezumi.example/${key}`,
	});
	return renderPortfolioPage({
		view: options.adjust?.(view) ?? view,
		messages,
		year: 2026,
		creditUrl: "https://rezumi.example",
	});
}

/** Globals an effect may use: the page's document and the language's own objects. */
const GLOBALS = new Set(["document", "undefined", "Array", "Intl", "JSON", "Map", "Math", "Promise", "String"]);

/**
 * A script's size as visitors get it, near enough: without its whitespace. The page ships each effect's own source,
 * which the production bundle minifies; tests see it as the test transform prints it, spaces and all.
 */
const shippedSize = (source: string) => source.replace(/\s+/g, "").length;

/**
 * The names a script reads without declaring them anywhere inside itself (a flat, scope-blind check: any declaration
 * counts everywhere), from its syntax tree.
 */
function freeNames(source: string): string[] {
	type Node = { type: string; [key: string]: unknown };
	const declared = new Set<string>();
	const used = new Set<string>();
	const declare = (pattern: Node | null | undefined): void => {
		if (!pattern) return;
		if (pattern.type === "Identifier") declared.add(pattern.name as string);
		else if (pattern.type === "ArrayPattern") (pattern.elements as (Node | null)[]).forEach(declare);
		else if (pattern.type === "ObjectPattern")
			for (const property of pattern.properties as Node[])
				declare((property.type === "RestElement" ? property.argument : property.value) as Node);
		else if (pattern.type === "AssignmentPattern") declare(pattern.left as Node);
		else if (pattern.type === "RestElement") declare(pattern.argument as Node);
	};
	const walk = (node: unknown, parent?: Node, key?: string): void => {
		if (!node || typeof node !== "object" || typeof (node as Node).type !== "string") return;
		const current = node as Node;
		if (current.type === "VariableDeclarator") declare(current.id as Node);
		if (current.type === "CatchClause") declare(current.param as Node);
		if (/Function/.test(current.type)) {
			declare(current.id as Node);
			for (const param of current.params as Node[]) declare(param);
		}
		if (current.type === "Identifier") {
			const property = parent?.type === "MemberExpression" && key === "property" && !parent.computed;
			const objectKey = parent?.type === "Property" && key === "key" && !parent.computed;
			if (!property && !objectKey) used.add(current.name as string);
			return;
		}
		for (const [childKey, value] of Object.entries(current))
			if (Array.isArray(value)) for (const child of value) walk(child, current, childKey);
			else walk(value, current, childKey);
	};
	walk(parseAst(source));
	return [...used].filter((name) => !declared.has(name));
}

/** The name as a reader gets it: the h1's text without tags. */
const nameText = (html: string) =>
	/<h1[^>]*>([\s\S]*?)<\/h1>/
		.exec(html)?.[1]
		?.replace(/<[^>]+>/g, "")
		.trim();

const SCRIPT_EFFECTS = ["typewriter", "scramble", "vector-hover"] as const;

describe("intro effects", () => {
	for (const theme of PORTFOLIO_THEMES)
		for (const effect of PORTFOLIO_THEME_INFO[theme].effects)
			it(`${theme} × ${effect}: the real text is in the page and only that effect's code ships`, () => {
				const page = render(effect, { theme, phrases: ["UX Researcher", "Mentor"] });
				expect(nameText(page.html)).toBe("Nadia Rahmawati");
				expect(page.html).not.toMatch(/undefined|NaN/);
				if (effect === "none") {
					expect(page.html).not.toContain("data-pfx");
					expect(page.css).not.toContain("pfx");
					expect(page.script).toBe(PORTFOLIO_PAGE_SCRIPT);
					return;
				}
				expect(page.html).toContain(`data-pfx="${effect}"`);
				expect(page.css).toContain(EFFECT_CSS[effect].trim().slice(0, 40));
				for (const other of Object.keys(EFFECT_CSS) as (keyof typeof EFFECT_CSS)[])
					if (other !== effect && !EFFECT_CSS[effect].includes(EFFECT_CSS[other].trim()))
						expect(page.css).not.toContain(EFFECT_CSS[other].trim());
				const extra = page.script.slice(PORTFOLIO_PAGE_SCRIPT.length);
				expect(page.script.startsWith(PORTFOLIO_PAGE_SCRIPT)).toBe(true);
				if ((SCRIPT_EFFECTS as readonly string[]).includes(effect)) expect(extra.length).toBeGreaterThan(0);
				else expect(extra).toBe("");
				// `02-teknis.md` section 23: an effect's script stays under 3 KB.
				expect(extra.length).toBeLessThanOrEqual(3 * 1024);
			});

	it("falls back to the theme's default for an effect the theme doesn't offer", () => {
		// Prima offers none, fade-up, shimmer and typewriter; its default is none.
		const page = render("scramble", { theme: "prima" });
		expect(page.html).not.toContain("data-pfx");
	});

	it("types the headline first, keeps every phrase readable and hides the moving copy from screen readers", () => {
		const page = render("typewriter", { phrases: ["UX Researcher", "Mentor"] });
		const headline = /<p[^>]*data-pfx="typewriter"[^>]*>([\s\S]*?)<\/p>/.exec(page.html)?.[0] ?? "";
		expect(headline).toContain('aria-hidden="true"');
		expect(headline).toContain('<span class="sr-only">Product Designer · UX Researcher · Mentor</span>');
		expect(headline).toContain('<span class="pfx-type__out">Product Designer</span>');
	});

	it("types at most the headline and the roles the limit allows, whatever a view holds", () => {
		const roles = ["UX Researcher", "Mentor", "Too many", "Way too many"];
		const page = render("typewriter", {
			adjust: (view) => ({ ...view, design: { ...view.design, effect: { ...view.design.effect, phrases: roles } } }),
		});
		const phrases = JSON.parse(
			(/data-pfx-phrases="([^"]+)"/.exec(page.html)?.[1] ?? "[]").replaceAll("&quot;", '"'),
		) as string[];
		expect(phrases).toEqual(["Product Designer", ...roles.slice(0, PORTFOLIO_LIMITS.typewriterPhrases)]);
	});

	it("leaves the typewriter off when there is only one thing to type", () => {
		expect(render("typewriter", { headline: "" }).html).not.toContain("data-pfx");
		expect(render("typewriter", { phrases: ["Product Designer"] }).html).not.toContain("data-pfx");
	});

	it("plays on the headline when asked, and on the name when there's no headline", () => {
		expect(render("shimmer", { target: "headline" }).html).toMatch(/<p[^>]*data-pfx="shimmer"[^>]*>Product Designer/);
		expect(render("shimmer", { target: "headline", headline: "" }).html).toMatch(/<h1[^>]*data-pfx="shimmer"/);
	});

	it("keeps a Latin name in order on a right-to-left page", () => {
		expect(render("fade-up").html).toContain('<span dir="auto"><span class="pfx-w" style="--i:0">Nadia</span>');
	});

	it("moves only for visitors who don't ask for less motion", () => {
		for (const [effect, css] of Object.entries(EFFECT_CSS)) {
			const outside = css.replace(/@media \(prefers-reduced-motion:no-preference\)[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
			expect(outside, effect).not.toMatch(/animation:pfx/);
		}
		expect(PREVIEW_STILL_CSS).toContain("animation:none!important");
	});

	it("ships self-contained scripts: every name they read is their own or the browser's", () => {
		for (const effect of SCRIPT_EFFECTS) {
			const script = effectScript(effect);
			// Called in a try, so an effect that fails can't stop the script after it.
			expect(script).toMatch(/^try\{.*\(document\)\}catch\{\}$/s);
			expect(script).not.toMatch(/\bimport\b|\brequire\(|<\/script/i);
			expect(
				freeNames(script).filter((name) => !GLOBALS.has(name)),
				effect,
			).toEqual([]);
			const document = {
				defaultView: { matchMedia: () => ({ matches: false }), performance: { now: () => 0 } },
				querySelectorAll: () => [],
			};
			// oxlint-disable-next-line no-new-func -- runs the inlined source against a document of nothing.
			expect(() => new Function("document", script)(document)).not.toThrow();
		}
		// The check itself finds a name from outside.
		expect(freeNames("(d=>{const w=d.defaultView;w.alert(OUTSIDE)})(document);")).toEqual(["OUTSIDE", "document"]);
	});

	it("keeps the page script and the largest effect's within 6 KB together, and each effect within 3 KB", () => {
		const largest = Math.max(...SCRIPT_EFFECTS.map((effect) => shippedSize(effectScript(effect))));
		expect(largest).toBeLessThanOrEqual(3 * 1024);
		// `02-teknis.md` sections 5.2 and 22: a page ships its script and at most one effect's.
		expect(shippedSize(PORTFOLIO_PAGE_SCRIPT) + largest).toBeLessThanOrEqual(6 * 1024);
	});

	it("finishes typing within five seconds, pauses included, however long the phrases", () => {
		for (const phrases of [
			["Product Designer", "UX Researcher", "Mentor"],
			["x".repeat(300), "y".repeat(40), "z".repeat(40)],
			["a", "b"],
			["Head", "One", "Two", "Three", "Four", "Five"],
		]) {
			const delays: number[] = [];
			const out = { textContent: "" };
			const element = {
				dataset: { pfxPhrases: JSON.stringify(phrases) },
				querySelector: () => out,
				classList: { add: () => undefined, remove: () => undefined },
			};
			const window = {
				matchMedia: () => ({ matches: false }),
				setTimeout: (_: () => void, delay: number) => delays.push(delay),
				clearTimeout: () => undefined,
			};
			EFFECT_RUNNERS.typewriter?.({
				defaultView: window,
				querySelectorAll: () => [element],
			} as unknown as Document);
			expect(Math.max(...delays), phrases.join("|").slice(0, 40)).toBeLessThanOrEqual(5000);
			expect(delays.length).toBeGreaterThan(phrases.length);
		}
	});

	it("shows Gradien hidup over a headline whose theme sets its colour (Paper, Mozaik)", () => {
		// A theme's `color` on the headline outranks `[data-pfx]`; the text fill doesn't depend on it.
		expect(EFFECT_CSS.gradient).toContain("-webkit-text-fill-color:transparent");
		expect(EFFECT_CSS.gradient).not.toMatch(/[{;]color:transparent/);
		expect(EFFECT_CSS.gradient).toContain(
			'@media (forced-colors:active){[data-pfx="gradient"]{-webkit-text-fill-color:currentColor}}',
		);
	});

	it("ends Kilau's sweep on the text's own colour, as it looks without motion", () => {
		expect(EFFECT_CSS.shimmer).toContain("linear-gradient(100deg,currentColor 0 38%");
		expect(EFFECT_CSS.shimmer).toContain("currentColor 62% 100%");
		expect(EFFECT_CSS.shimmer).toContain("-webkit-text-fill-color:transparent");
		expect(EFFECT_CSS.shimmer).not.toContain("var(--pf-text)");
	});

	it("keeps Gradien hidup's colours readable in both modes of every theme, for every accent", () => {
		const accents = [
			...Object.values(PORTFOLIO_ACCENTS).map((accent) => accent.color),
			"#FFD60A",
			"#111111",
			"#FFFFFF",
		];
		for (const palette of Object.values(THEME_PALETTES))
			for (const mode of ["light", "dark"] as const)
				for (const accent of accents)
					for (const colour of gradientColors(accent, palette[mode])) {
						expect(contrastRatio(colour, palette[mode].bg)).toBeGreaterThanOrEqual(4.5);
						expect(contrastRatio(colour, palette[mode].surface)).toBeGreaterThanOrEqual(4.5);
					}
	});
});
