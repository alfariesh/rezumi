import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { count, expectSoundPage, testImage as image, renderTestPage, testResume } from "../../fixtures.test-helpers";
import { headingId } from "../../shared/primitives";

/** Every section and block type Prima draws, with highlights for the KPI strip. */
const fullData: PortfolioDataInput = {
	theme: "prima",
	hero: {
		greeting: "I design calm apps for busy people.",
		availability: { show: true, text: "" },
		highlights: [
			{ id: "h1", label: "Monthly users", value: { kind: "number", number: 4_000_000 }, format: "compact" },
			{ id: "h2", label: "Successful payments", value: { kind: "number", number: 97.5 }, format: "percent" },
			{ id: "h3", label: "Ranking", value: { kind: "text", text: "Top 3" }, format: "plain" },
		],
		buttons: [{ kind: "resume" }, { kind: "contact" }],
	},
	about: { content: "<p>Hello there.</p>" },
	works: {
		items: [
			{
				id: "w1",
				slug: "kopi-app",
				title: "Coffee ordering app",
				summary: "Ordering in three taps.",
				role: "Lead designer",
				date: "2024",
				tags: ["Mobile"],
				cover: image("cover-1"),
				highlightMetricId: "m1",
				primaryLink: { label: "Case study", url: "https://behance.example.test/kopi" },
				blocks: [
					{ id: "b1", type: "text", html: "<h3>Problem</h3><p>Orders took too long.</p>" },
					{ id: "b2", type: "images", layout: "grid", images: [{ ...image("shot-1"), caption: "Home" }] },
					{
						id: "b3",
						type: "metrics",
						items: [
							{
								id: "m1",
								label: "Checkout conversion",
								value: { kind: "number", number: 2.8 },
								format: "percent",
								change: { direction: "up", text: "+35%", good: true },
								before: 2.1,
								series: [1.9, 2.1, 2.4, 2.8],
								context: "3 months after launch",
							},
						],
					},
					{
						id: "b4",
						type: "video",
						provider: "youtube",
						videoId: "dQw4w9WgXcQ",
						title: "Checkout demo",
						thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
						thumbnail: image("video-thumb", 480, 360),
					},
					{
						id: "b5",
						type: "pdf",
						file: "uploads/user-1/documents/portfolio/case-study.pdf",
						title: "Case study",
						pages: 12,
						bytes: 2_400_000,
						preview: image("case-study-page", 800, 1131),
					},
					{
						id: "b6",
						type: "link",
						url: "https://medium.example.test/@nadia/payments",
						title: "How we cut failed payments",
						siteName: "Medium",
						brandIcon: "medium",
					},
				],
			},
			{ id: "w2", slug: "no-cover", title: "Work without pictures", summary: "", blocks: [] },
		],
	},
	services: {
		items: [
			{
				id: "s1",
				title: "Design audit",
				description: "Fixes, in order.",
				price: "From Rp7.5m",
				cta: { kind: "whatsapp" },
			},
		],
	},
	testimonials: {
		items: [
			{ id: "t1", quote: "Calm and clear.", name: "Damar Wicaksana", role: "Engineering Manager", consent: true },
		],
	},
	clients: {
		items: [
			{ id: "c1", name: "Kilau Pay" },
			{ id: "c2", name: "Rantai", logo: image("logo", 600, 200) },
		],
	},
	custom: [
		{ id: "x1", title: "Principles", content: "<ol><li>Write it down.</li><li>Review often.</li></ol>", hidden: false },
	],
	location: {
		label: "Jakarta, Indonesia",
		point: { lat: -6.2088, lng: 106.8456, precision: "city" },
		showMap: true,
		map: { light: image("map-light", 800, 480), dark: image("map-dark", 800, 480) },
		workModes: ["hybrid"],
		relocate: false,
		timezone: "Asia/Jakarta",
		showLocalTime: true,
	},
	contact: { whatsapp: { show: true, number: "6281255501824" }, note: "Let's talk." },
};

/** The test resume with certificates, awards and languages, so the photo caption and the short lists show. */
function primaResume(): ResumeData {
	const resume = testResume();
	resume.sections.certifications.items = [
		{
			id: "c1",
			hidden: false,
			title: "Certified Financial Planner",
			issuer: "FPSB",
			date: "2020",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
		{
			id: "c2",
			hidden: false,
			title: "WMI License",
			issuer: "OJK",
			date: "2019",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
		{
			id: "c3",
			hidden: false,
			title: "Third Certificate",
			issuer: "",
			date: "",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["certifications"]["items"];
	resume.sections.awards.items = [
		{
			id: "a1",
			hidden: false,
			title: "Banker of the Year",
			awarder: "Bank",
			date: "2024",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["awards"]["items"];
	resume.sections.languages.items = [
		{ id: "l1", hidden: false, language: "English", fluency: "Fluent", level: 4 },
	] as ResumeData["sections"]["languages"]["items"];
	resume.sections.education.items = [
		{
			id: "ed1",
			hidden: false,
			school: "Institut Teknologi Bandung",
			degree: "Bachelor",
			area: "Industrial Engineering",
			grade: "",
			location: "Bandung",
			period: "2012 – 2016",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["education"]["items"];
	resume.sections.skills.items = [
		{
			id: "sk1",
			hidden: false,
			icon: "",
			iconColor: "",
			name: "Design",
			proficiency: "",
			level: 0,
			keywords: ["Figma"],
		},
	] as ResumeData["sections"]["skills"]["items"];
	return resume;
}

function render(data: PortfolioDataInput, resume: ResumeData | null = primaResume(), workId?: string) {
	const rendered = renderTestPage(
		{ theme: "prima", ...data },
		{ resume, ...(workId ? { page: { kind: "work" as const, workId } } : {}) },
	);
	expectSoundPage(rendered.html, "prima");
	return rendered;
}

const SCHEMES = ["light", "dark"] as const;

describe("Prima theme", () => {
	it("draws every section as a row with its anchor and heading, in both modes", () => {
		for (const scheme of SCHEMES) {
			const { view, page, html } = render({ ...fullData, design: { scheme } });
			expect(html).toMatch(/^<div class="pf" data-theme="prima">/);
			expect(count(html, /<h1[ >]/g)).toBe(1);
			expect(html).toContain('<main class="pf-wrap pr-main" id="main" tabindex="-1">');
			for (const section of view.sections) {
				expect(html).toContain(`id="${section.anchor}"`);
				expect(html).toContain(`aria-labelledby="${headingId(section.anchor)}"`);
				expect(html).toContain(`id="${headingId(section.anchor)}"`);
			}
			for (const anchor of [
				"about",
				"experience",
				"work",
				"services",
				"testimonials",
				"clients",
				"contact",
				"custom-x1",
			])
				expect(html).toContain(`id="${anchor}"`);
			expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
			expect(page.css).not.toMatch(/undefined|NaN/);
			expect(page.css).toContain('.pf[data-theme="prima"]');
			expect(page.scheme).toBe(scheme);
		}
	});

	it("puts the headline with the name, the photo with the first two certificates, and the KPI strip", () => {
		const { html } = render(fullData);
		expect(html).toMatch(
			/<h1 class="pf-name pr-name" style="--name-word:\d+">Nadia Rahmawati<\/h1><p class="pr-headline">/,
		);
		expect(html).toContain('data-variant="photo-right"');
		expect(html).toMatch(/<figure class="pr-photo"><img [^>]*alt="[^"]+"[^>]*loading="eager"/);
		expect(html).toContain("<figcaption>Certified Financial Planner · WMI License</figcaption>");
		expect(html).not.toContain("Third Certificate ·");
		expect(html).toContain('<div class="pr-kpis" style="--pr-kpis:3"><dl class="pf-metrics" data-variant="kpi">');
	});

	it("draws the intro without a photo in one column, and without a caption when there are no certificates", () => {
		const resume = primaResume();
		resume.picture.url = "";
		resume.sections.certifications.items = [];
		const { html } = render(fullData, resume);
		expect(html).toContain('data-variant="no-photo"');
		expect(html).not.toContain("pr-photo");
		expect(html).not.toContain("<figcaption>Certified");
	});

	it("offers a send-message button in the navigation only when there is a contact section", () => {
		const { html, messages } = render(fullData);
		expect(html).toContain(
			`<li class="pr-head__cta"><a class="pf-btn pf-btn--primary" href="#contact" data-pf-event="contact">${messages.sendMessage}</a></li>`,
		);
		const { html: without } = render({
			...fullData,
			sections: { hidden: ["contact"] },
		});
		expect(without).toContain("pf-nav__links");
		expect(without).not.toContain("pr-head__cta");
	});

	it("titles the Work section Case studies unless the person renamed it", () => {
		const { html, messages } = render(fullData);
		expect(html).toContain(`<h2 class="pf-section__title" id="work--title">${messages.caseStudies}</h2>`);
		expect(html).toContain(`<a href="#work">${messages.caseStudies}</a>`);
		const { html: renamed } = render({ ...fullData, sections: { titles: { work: "Selected projects" } } });
		expect(renamed).toContain('<h2 class="pf-section__title" id="work--title">Selected projects</h2>');
	});

	it("draws work cards with covers, alt text and a detail with every block type", () => {
		const { view, html } = render(fullData);
		expect(html).toContain('<ul class="pr-works" data-variant="grid-2">');
		expect(html).toContain('<li class="pr-work" data-noimg="">');
		expect(html).toMatch(/<span class="pr-card__meta">2024 · Lead designer<\/span>/);
		expect(html).toMatch(/<span class="pf-work-metric"><b>2,8%<\/b>/);
		expect(html).not.toMatch(/pf-detail|pf-lightbox/);
		expect(view.works.map((item) => item.href)).toEqual(view.works.map((item) => `/nadia/work/${item.slug}`));
		for (const item of view.works) expect(html).toContain(`href="${item.href}"`);
		// Text (its heading right under the page's h1), images, metrics, video, PDF and link blocks on the work's page.
		const detail = render(fullData, primaResume(), "w1").html;
		expect(detail).toContain("<h2>Problem</h2>");
		expect(detail).toContain('class="pf-gallery" data-layout="grid"');
		expect(detail).toContain('class="pf-metric__chart"');
		expect(detail).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"');
		expect(detail).toContain('data-pf-event="document"');
		expect(detail).toContain('class="pf-link"');
		expect(count(detail, /class="pf-lightbox"/g)).toBe(1);
		// Every picture has its text alternative or is marked decorative.
		for (const tag of detail.match(/<img [^>]*>/g) ?? []) expect(tag).toMatch(/ alt="/);
	});

	it("groups consecutive short lists in one row and keeps lone ones as rows", () => {
		const { html } = render(fullData);
		// Prima's order puts certifications and awards next to each other.
		expect(html).toMatch(
			/<div class="pr-row pr-facts"><div class="pf-extras"><section class="pf-section pf-extra" id="certifications"[^>]*><h2 class="pf-extra__title" id="certifications--title">[^<]+<\/h2>.*?<section class="pf-section pf-extra" id="awards"/,
		);
		expect(html).toMatch(/<section class="pf-section pr-row" id="languages" aria-labelledby="languages--title">/);
	});

	it("puts the location card beside the contact details", () => {
		const { html } = render(fullData);
		expect(html).toContain('<div class="pr-contact" data-loc="">');
		expect(html).toContain('class="pf-loc"');
		const resume = primaResume();
		resume.basics.location = "";
		const { location: _location, ...withoutLocation } = fullData;
		const { html: noLocation } = render(withoutLocation, resume);
		expect(noLocation).toContain('<div class="pr-contact">');
		expect(noLocation).not.toContain('class="pf-loc"');
	});

	it("draws every Prima variant in light and dark", () => {
		const variants = PORTFOLIO_THEME_INFO.prima.variants;
		for (const scheme of SCHEMES)
			for (const [key, values] of Object.entries(variants))
				for (const value of values) {
					const data = { ...fullData, design: { scheme, variants: { [key]: value } } };
					// A work's metrics, which take the metric variant, are on its own page.
					const { html } = key === "metric" ? render(data, primaResume(), "w1") : render(data);
					expect(html).toContain(`data-variant="${value}"`);
					expect(html).not.toMatch(/undefined|NaN/);
				}
	});

	it("draws an unsupported variant as Prima's default", () => {
		const { html } = render({ ...fullData, design: { variants: { work: "bento", hero: "big-name" } } });
		expect(html).toContain('<ul class="pr-works" data-variant="grid-2">');
		expect(html).toContain('data-variant="photo-right"');
	});

	it("draws the intro backgrounds, falling back to plain for an image background without a picture", () => {
		const plain = render(fullData).html;
		expect(plain).toContain('data-bg="plain"');
		const pattern = render({ ...fullData, hero: { ...fullData.hero, background: { kind: "pattern" } } }).html;
		expect(pattern).toContain('data-bg="pattern"');
		const missing = render({ ...fullData, hero: { ...fullData.hero, background: { kind: "image" } } }).html;
		expect(missing).toContain('data-bg="plain"');
		const picture = render({
			...fullData,
			hero: { ...fullData.hero, background: { kind: "image", image: image("hero-bg") } },
		}).html;
		expect(picture).toContain('data-bg="image"');
		expect(picture).toContain(
			"--pf-hero-image:url(&quot;https://rezumi.example/uploads/user-1/pictures/portfolio/hero-bg.webp&quot;)",
		);
	});

	it("draws an almost empty portfolio without empty headings", () => {
		const resume = testResume();
		resume.sections.experience.items = [];
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		resume.basics.location = "";
		resume.picture.url = "";
		for (const scheme of SCHEMES) {
			const { html } = render({ about: { content: "" }, works: { items: [] }, design: { scheme } }, resume);
			expect(html).toContain('data-theme="prima"');
			expect(html).toContain("Nadia Rahmawati");
			expect(html).toContain('data-variant="no-photo"');
			expect(html).not.toContain('<section class="pf-section');
			expect(html).not.toMatch(/<h2[^>]*><\/h2>/);
			expect(html).not.toContain("pf-nav__links");
			expect(html).not.toContain("pr-kpis");
			expect(html).not.toMatch(/undefined|NaN/);
		}
	});

	it("loads the serif name's weight and the quotes' weight", () => {
		const { page } = render(fullData);
		expect(page.css).toMatch(/font-family:"?Source Serif 4"?;font-weight:600/);
		expect(page.css).toMatch(/font-family:"?Source Serif 4"?;font-weight:400/);
		expect(page.preloadFont).toBeTruthy();
	});

	it("writes right-to-left pages", () => {
		const { html, page } = render({ ...fullData, locale: "ar-SA" });
		expect(page.dir).toBe("rtl");
		expect(html).toContain('class="pf-icon pf-flip"');
		expect(html).not.toMatch(/undefined|NaN/);
	});
});
