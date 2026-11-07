import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { PortfolioVariantKey } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import {
	count,
	expectSoundPage,
	fullTestResume,
	testImage as image,
	renderTestPage,
	testResume,
} from "../../fixtures.test-helpers";
import { headingId } from "../../shared/primitives";
import { KANVAS_CSS } from "./css";

const work = (index: number, cover = true) => ({
	id: `w${index}`,
	slug: `work-${index}`,
	title: `Campaign ${index}`,
	summary: "Shot on three farms.",
	role: "Creative director",
	date: "2025",
	tags: ["Campaign", "Photography", "Video"],
	...(cover ? { cover: image(`cover-${index}`) } : {}),
	blocks: [{ id: `w${index}-text`, type: "text" as const, html: "<p>Notes.</p>" }],
});

/** Every section and every work block type, with a work that has no picture. */
const fullData: PortfolioDataInput = {
	theme: "kanvas",
	hero: {
		greeting: "I build brands from the first moodboard to the last retouch.",
		availability: { show: true, text: "" },
		highlights: [
			{ id: "h1", label: "Pitches won", value: { kind: "text", text: "21/36" }, format: "plain" },
			{ id: "h2", label: "Magazine covers", value: { kind: "number", number: 14 }, format: "plain" },
			{ id: "h3", label: "Clients", value: { kind: "number", number: 60 }, format: "plain", suffix: "+" },
		],
		buttons: [{ kind: "contact" }, { kind: "resume" }],
	},
	about: { content: "<p><strong>Creative director</strong> who still shoots his campaigns.</p>" },
	works: {
		items: [
			{
				id: "w1",
				slug: "dari-lereng",
				title: "Kopi Tanah Tinggi",
				summary: "A campaign shot on three farms.",
				role: "Creative director",
				date: "2025",
				tags: ["Campaign"],
				cover: { ...image("cover-1"), focus: { x: 0.3, y: 0.6 } },
				highlightMetricId: "m1",
				primaryLink: { label: "Case study", url: "https://behance.example.test/lereng" },
				blocks: [
					{ id: "b1", type: "text", html: "<h3>Problem</h3><p>Show the slopes.</p>" },
					{
						id: "b2",
						type: "images",
						layout: "grid",
						images: [{ ...image("shot-1"), caption: "Morning" }, image("shot-2", 900, 1350)],
					},
					{
						id: "b3",
						type: "metrics",
						items: [
							{
								id: "m1",
								label: "Online sales",
								value: { kind: "number", number: 40 },
								format: "percent",
								prefix: "+",
								change: { direction: "up", text: "+40%", good: true },
								before: 28,
								series: [1, 2, 3, 5],
								progress: 70,
								context: "8 weeks",
							},
						],
					},
					{
						id: "b4",
						type: "video",
						provider: "youtube",
						videoId: "dQw4w9WgXcQ",
						title: "Campaign film",
						thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
						thumbnail: image("video-thumb", 480, 360),
					},
					{
						id: "b5",
						type: "pdf",
						file: "uploads/user-1/documents/portfolio/deck.pdf",
						title: "Campaign deck",
						pages: 18,
						bytes: 3_200_000,
						preview: image("deck-page", 800, 1131),
					},
					{
						id: "b6",
						type: "link",
						url: "https://behance.example.test/lereng",
						title: "On Behance",
						description: "The whole process.",
						siteName: "Behance",
					},
				],
			},
			work(2),
			work(3),
			work(4, false),
		],
	},
	services: {
		items: [
			{
				id: "s1",
				title: "Campaign direction",
				description: "From idea to shoot.",
				price: "From Rp35m",
				cta: { kind: "whatsapp" },
			},
			{ id: "s2", title: "Lighting class", description: "", price: "", cta: { kind: "contact" } },
		],
	},
	testimonials: {
		items: [
			{
				id: "t1",
				quote: "He photographed our farm like someone who grew up there.",
				name: "Maya Lestari",
				role: "Founder",
				sourceUrl: "https://www.linkedin.example.test/in/maya",
				consent: true,
			},
		],
	},
	clients: {
		items: [
			{ id: "c1", name: "Kopi Tanah Tinggi" },
			{ id: "c2", name: "", logo: image("logo", 600, 200) },
		],
	},
	custom: [
		{
			id: "x1",
			title: "Next exhibition",
			content: "<p>March 2026.</p>",
			hidden: false,
			button: { kind: "link", label: "Ask for an invitation", url: "https://example.test/rsvp" },
		},
	],
	location: {
		label: "Bandung, Indonesia",
		point: { lat: -6.9175, lng: 107.6191, precision: "city" },
		showMap: true,
		map: { light: image("map-light", 800, 480), dark: image("map-dark", 800, 480) },
		workModes: ["onsite", "remote"],
		timezone: "Asia/Jakarta",
		showLocalTime: true,
	},
	contact: { whatsapp: { show: true, number: "6285755571462" }, note: "Got a brand that needs a visual story?" },
};

/** A resume with every section filled (awards, languages, volunteering, interests, its own sections…). */
const fullResume = fullTestResume;

function render(data: PortfolioDataInput, resume: ResumeData | null = fullResume()) {
	return renderTestPage(data, { resume, username: "bayu" });
}

/** The text of every `h2` with an id, keyed by id. */
function headings(html: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of html.matchAll(/<h2 class="[^"]*" id="([^"]+)">([\s\S]*?)<\/h2>/g))
		found.set(match[1] as string, (match[2] as string).replace(/<[^>]+>/g, "").trim());
	return found;
}

/** A selector list's selectors; commas inside `:is()` or `:lang()` don't separate them. */
function splitSelectors(list: string): string[] {
	const parts = [""];
	let depth = 0;
	for (const char of list) {
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (char === "," && depth === 0) parts.push("");
		else parts[parts.length - 1] += char;
	}
	return parts;
}

const expectSound = (html: string) => expectSoundPage(html, "kanvas");

describe("Kanvas", () => {
	const { view, page, html } = render(fullData);

	it("draws every section with its anchor and heading", () => {
		expectSound(html);
		expect(view.theme).toBe("kanvas");
		for (const section of view.sections) {
			expect(html, section.anchor).toContain(`id="${section.anchor}"`);
			expect(headings(html).get(headingId(section.anchor)), section.anchor).toBe(section.title);
		}
		for (const kind of ["awards", "languages", "volunteer", "interests", "profiles", "education", "skills"])
			expect(
				view.sections.some((section) => section.kind === kind),
				kind,
			).toBe(true);
		expect(view.sections.some((section) => section.kind === "resume")).toBe(true);
		expect(page.css).toContain(KANVAS_CSS);
		expect(page.css).not.toMatch(/undefined|NaN/);
	});

	it("puts the work grid right after the intro, its heading kept for screen readers", () => {
		expect(view.sections[0]?.kind).toBe("work");
		expect(html).toMatch(/<\/section><section class="pf-section kv-work" id="work" aria-labelledby="work--title">/);
		expect(html).toContain('<h2 class="pf-section__title kv-label sr-only" id="work--title">');
		expect(html).toContain('<ul class="kv-grid" data-variant="featured-grid">');
		expect(count(html, /class="kv-tile"/g)).toBe(4);
		// The first, biggest picture loads at once; the rest wait.
		expect(html).toMatch(
			/<li class="kv-tile"><a href="#work-dari-lereng"><div class="pf-cover kv-tile__img"><img [^>]*alt=""[^>]*loading="eager"/,
		);
		// Caption: title, year and tags, highlighted metric.
		expect(html).toContain('<span class="kv-cap__meta">2025 · Campaign · Photography</span>');
		expect(html).toMatch(/<span class="pf-work-metric"><b>\+40%<\/b><span>Online sales<\/span><\/span>/);
		// A work without a picture is a plain tile with its title.
		expect(html).toMatch(
			/<li class="kv-tile" data-noimg=""><a href="#work-work-4"><span class="kv-cap"><span class="kv-cap__title">Campaign 4</,
		);
	});

	it("draws the big-name intro with photo, headline, greeting, chips, buttons and big numbers", () => {
		expect(html).toMatch(/<section class="kv-hero" aria-label="[^"]+" data-variant="big-name" data-bg="plain">/);
		expect(html).toMatch(/<h1 class="pf-name kv-name" style="--name-word:\d+"/);
		expect(html).toContain('class="kv-photo"');
		expect(html).toContain('class="kv-greeting"');
		expect(html).toContain('<dl class="pf-metrics kv-stats" data-variant="big">');
		expect(html).toContain("21/36");
		expect(html).toContain('data-font-pair="archivo"');
	});

	it("opens every work in a detail with every block type", () => {
		expect(count(html, /class="pf-detail"/g)).toBe(view.works.length);
		const detail = html.slice(html.indexOf('id="work-dari-lereng" role="dialog"'));
		for (const part of [
			'class="pf-prose"',
			'class="pf-gallery" data-layout="grid"',
			'class="pf-metrics" data-variant="big"',
			'class="pf-video"',
			'class="pf-pdf"',
			'class="pf-link"',
			'class="pf-cover pf-detail__hero"',
		])
			expect(detail, part).toContain(part);
		expect(count(html, /class="pf-lightbox"/g)).toBe(1);
		expect(html).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"');
	});

	it("shares one row between short lists that follow each other, each keeping its own heading", () => {
		const group = /<div class="kv-sec kv-group"><p class="kv-label" aria-hidden="true">([^<]+)<\/p>/.exec(html);
		expect(group?.[1]).toContain(" · ");
		const grouped = view.sections.filter((section) => ["awards", "languages", "certifications"].includes(section.kind));
		for (const section of grouped)
			expect(html).toContain(`<h2 class="pf-extra__title" id="${headingId(section.anchor)}">`);
	});

	it("draws contact with its call to action, buttons and location card", () => {
		expect(html).toContain('<div class="kv-contact"><p class="kv-cta">Got a brand that needs a visual story?</p>');
		expect(html).toContain("https://wa.me/6285755571462");
		expect(html).toContain('class="pf-loc"');
	});

	it("supports every variant the theme lists, in light and dark", () => {
		const { variants } = PORTFOLIO_THEME_INFO.kanvas;
		for (const scheme of ["light", "dark"] as const)
			for (const [key, values] of Object.entries(variants) as [PortfolioVariantKey, readonly string[]][])
				for (const value of values) {
					const rendered = render({ ...fullData, design: { scheme, variants: { [key]: value } } });
					expectSound(rendered.html);
					expect(rendered.page.scheme).toBe(scheme);
					expect(rendered.html, `${key}=${value}`).toContain(`data-variant="${value}"`);
				}
	});

	it("draws an almost empty page without empty headings, and the intro without a photo", () => {
		const resume = testResume();
		resume.sections.experience.items = [];
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.headline = "";
		resume.basics.website = { url: "", label: "" };
		resume.basics.location = "";
		resume.picture.url = "";
		const { html: minimal } = render({ theme: "kanvas", about: { content: "" }, works: { items: [] } }, resume);
		expectSound(minimal);
		expect(minimal).toContain("Nadia Rahmawati");
		expect(minimal).not.toContain('<section class="pf-section');
		expect(minimal).not.toContain("pf-nav__links");
		expect(minimal).not.toContain("kv-hero__row");
		expect(minimal).toContain('data-variant="no-photo"');
		expect(minimal).not.toContain("kv-photo");
		expect(minimal).not.toContain("pf-lightbox");

		const noPhoto = render({ ...fullData, hero: { ...fullData.hero, showPicture: false } }).html;
		expect(noPhoto).toContain('data-variant="no-photo"');
		expect(noPhoto).not.toContain("kv-photo");
		expect(noPhoto).toContain('class="kv-headline"');
	});

	it("shows the work heading when the grid doesn't follow the intro", () => {
		const { html: later } = render({
			...fullData,
			sections: { order: ["about", "work"], hidden: [], titles: {}, hiddenItems: {} },
		});
		expect(later).toMatch(/<section class="pf-section kv-sec kv-sec--about"[\s\S]*<section class="pf-section kv-work"/);
		expect(later).toContain('<h2 class="pf-section__title kv-label" id="work--title">');
		// The first tile is below other content now: it loads lazily like the rest.
		expect(later).toContain('kv-tile__img"><img');
		expect(later).not.toMatch(/kv-tile__img"><img [^>]*loading="eager"/);
	});

	it("draws the intro background and the font pair's attribute", () => {
		const pattern = render({ ...fullData, hero: { ...fullData.hero, background: { kind: "pattern" } } }).html;
		expect(pattern).toContain('data-bg="pattern"');
		const picture = render({
			...fullData,
			hero: { ...fullData.hero, background: { kind: "image", image: image("hero-bg") } },
		}).html;
		expect(picture).toMatch(
			/data-bg="image" style="--pf-hero-image:url\(&quot;https:\/\/rezumi.example\/uploads\/user-1\/pictures\/portfolio\/hero-bg.webp&quot;\)"/,
		);
		const missing = render({ ...fullData, hero: { ...fullData.hero, background: { kind: "image" } } }).html;
		expect(missing).toContain('data-bg="plain"');
		const bodoni = render({ ...fullData, design: { fonts: { source: "pair", id: "bodoni-work" } } });
		expect(bodoni.html).toContain('data-font-pair="bodoni-work"');
		expect(bodoni.page.css).toContain("--pf-name-transform:none");
		expect(render({ ...fullData, design: { fonts: { source: "resume" } } }).html).not.toContain("data-font-pair");
	});

	it("writes right-to-left pages and very long names", () => {
		const rtl = render({ ...fullData, locale: "ar-SA" });
		expect(rtl.page.dir).toBe("rtl");
		expectSound(rtl.html);
		const long = render({ ...fullData, basics: { name: "Muhammad Abdurrahmanwijayakusuma Putra" } }).html;
		expect(long).toContain('style="--name-word:23"');
	});

	it("scopes every rule to the theme", () => {
		// Media queries only wrap rules; every rule inside and outside them starts at the theme's root.
		const rules = KANVAS_CSS.replace(/@media[^{]+\{/g, "").matchAll(/([^{}]+)\{[^{}]*\}/g);
		let total = 0;
		for (const [, selectors] of rules) {
			for (const selector of splitSelectors(selectors as string)) {
				expect(selector.trim()).toMatch(/^\.pf\[data-theme="kanvas"\]/);
				total++;
			}
		}
		expect(total).toBeGreaterThan(100);
	});
});
