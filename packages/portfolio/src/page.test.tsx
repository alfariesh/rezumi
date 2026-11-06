import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { renderPortfolioDocument } from "./document";
import { testResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { portfolioIconNames, renderPortfolioPage } from "./page";
import { buildPortfolioView } from "./view";

const image = (name: string, width = 1600, height = 1200) => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	thumbKey: `uploads/user-1/pictures/portfolio/${name}-small.webp`,
	width,
	height,
	alt: `${name} picture`,
});

/** Every section and block type, with metrics using every optional part. */
const fullData: PortfolioDataInput = {
	hero: {
		greeting: "I design calm apps for busy people.",
		availability: { show: true, text: "" },
		highlights: [
			{ id: "h1", label: "Monthly users", value: { kind: "number", number: 4_000_000 }, format: "compact" },
			{ id: "h2", label: "Successful payments", value: { kind: "number", number: 97.5 }, format: "percent" },
			{ id: "h3", label: "Ranking", value: { kind: "text", text: "Top 3" }, format: "plain" },
		],
		buttons: [{ kind: "resume" }, { kind: "contact" }, { kind: "link", url: "https://dribbble.example.test/nadia" }],
	},
	about: { content: '<p>Hello <script>alert(1)</script><a href="https://example.test">there</a>.</p>' },
	works: {
		items: [
			{
				id: "w1",
				slug: "kopi-app",
				title: "Coffee ordering app",
				summary: "Ordering in three taps.",
				role: "Lead designer",
				date: "2024",
				tags: ["Mobile", "Research"],
				cover: { ...image("cover-1"), focus: { x: 0.3, y: 0.6 } },
				highlightMetricId: "m1",
				primaryLink: { label: "Case study", url: "https://behance.example.test/kopi" },
				blocks: [
					{ id: "b1", type: "text", html: "<h3>Problem</h3><p>Orders took too long.</p>" },
					{
						id: "b2",
						type: "images",
						layout: "grid",
						images: [
							{ ...image("shot-1"), caption: "Home screen" },
							{ ...image("shot-2"), caption: "" },
						],
					},
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
							{
								id: "m2",
								label: "Revenue",
								value: { kind: "number", number: 1_200_000_000 },
								format: "currency",
								currency: "IDR",
								progress: 80,
								change: { direction: "down", text: "-4%", good: false },
							},
						],
					},
					{ id: "b4", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ" },
				],
			},
			{ id: "w2", slug: "no-cover", title: "Work without pictures", summary: "", blocks: [] },
			{ id: "w3", slug: "hidden-work", title: "Hidden work", hidden: true, blocks: [] },
		],
	},
	services: {
		items: [
			{
				id: "s1",
				title: "Design audit",
				description: "A list of fixes, in order.",
				price: "From Rp7.5m",
				cta: { kind: "whatsapp" },
			},
		],
	},
	testimonials: {
		items: [
			{
				id: "t1",
				quote: "Calm and clear.",
				name: "Damar Wicaksana",
				role: "Engineering Manager",
				sourceUrl: "https://www.linkedin.example.test/in/damar",
				consent: true,
			},
		],
	},
	clients: {
		items: [
			{ id: "c1", name: "Kilau Pay" },
			{ id: "c2", name: "", logo: image("logo", 600, 200) },
		],
	},
	custom: [{ id: "x1", title: "Product notes", content: "<p>Every Friday.</p>", hidden: false }],
	location: {
		label: "Jakarta, Indonesia",
		workModes: ["hybrid", "remote"],
		relocate: true,
		timezone: "Asia/Jakarta",
		showLocalTime: true,
	},
	contact: { whatsapp: { show: true, number: "6281255501824" }, note: "Let's talk." },
};

function render(data: PortfolioDataInput, resume: ResumeData | null = testResume(), locale?: string) {
	const parsed = parseWritablePortfolioData(locale ? { ...data, locale } : data);
	const messages = portfolioMessages(parsed.locale ?? resume?.metadata.page.locale ?? "en-US");
	const view = buildPortfolioView({
		portfolio: { data: parsed },
		resume: resume ? { data: resume } : null,
		owner: { name: "Account Name", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `https://rezumi.example/${key}`,
		links: { resume: "https://rezumi.example/nadia/cv", resumePdf: null },
	});
	const page = renderPortfolioPage({
		view,
		messages,
		year: 2026,
		creditUrl: "https://rezumi.example",
		imageUrl: (src) => (src.startsWith("/") ? `https://rezumi.example${src}` : src),
		icons: {},
	});
	return { view, page, html: page.html };
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("renderPortfolioPage (Lugas)", () => {
	const { view, page, html } = render(fullData);

	it("draws every section with its anchor and heading, and no undefined or NaN", () => {
		for (const anchor of ["about", "work", "services", "testimonials", "clients", "experience", "contact", "custom-x1"])
			expect(html).toContain(`id="${anchor}"`);
		expect(html).toContain('id="custom-x1-title"');
		expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
		expect(page.css).not.toMatch(/undefined|NaN/);
		expect(page.lang).toBe("id-ID");
	});

	it("leaves out hidden works and resume items, and references", () => {
		expect(html).not.toContain("Hidden work");
		expect(html).not.toContain("Hidden Co");
		expect(html).not.toContain("Someone Else");
	});

	it("opens each shown work's detail by its anchor, with previous and next", () => {
		expect(html).toContain('href="#work-kopi-app"');
		expect(html).toContain('id="work-kopi-app" role="dialog" aria-labelledby="work-kopi-app-title"');
		expect(html).toContain('href="#work-no-cover" aria-label="Berikutnya: Work without pictures"');
		expect(count(html, /class="pf-detail"/g)).toBe(view.works.length);
	});

	it("draws metrics as definition lists with every part as text", () => {
		expect(html).toMatch(/<dl class="pf-metrics lg-stats" data-variant="big">/);
		expect(html).toMatch(/4\sjt/);
		expect(html).toContain("97,5%");
		expect(html).toContain("Top 3");
		// The block's metrics: value, change for screen readers, before and after, sparkline, progress, context.
		expect(html).toContain("2,8%");
		expect(html).toContain("Naik, perubahan baik:");
		expect(html).toMatch(/Sebelum 2,1%/);
		expect(html).toContain('class="pf-metric__chart"');
		expect(html).toMatch(/role="img" aria-label="Progres: 80%"/);
		expect(html).toContain("3 months after launch");
		// The work card's highlighted metric.
		expect(html).toMatch(/<span class="pf-work-metric"><b>2,8%<\/b><span>Checkout conversion<\/span><\/span>/);
	});

	it("moves the first picture's preload into the head", () => {
		expect(page.head).toMatch(/^<link rel="preload" as="image"/);
		expect(html.startsWith("<div")).toBe(true);
	});

	it("gives images their size, text alternatives, lazy loading and focus point", () => {
		expect(html).toMatch(
			/<img class="lg-photo" src="https:\/\/rezumi.example\/uploads\/user-1\/pictures\/formal.webp"[^>]*loading="eager"/,
		);
		expect(html).toContain('alt="shot-1 picture" width="1600" height="1200" loading="lazy" decoding="async"');
		expect(html).toContain("object-position:30% 60%");
		expect(html).toContain('srcSet="https://rezumi.example/uploads/user-1/pictures/portfolio/shot-1-small.webp 800w');
	});

	it("cleans rich text and marks outgoing links as user content", () => {
		expect(html).not.toContain("<script>alert");
		expect(html).toContain(
			'<a href="https://example.test" rel="ugc nofollow noopener noreferrer" target="_blank">there</a>',
		);
		expect(html).toContain(
			'href="https://dribbble.example.test/nadia" target="_blank" rel="ugc nofollow noopener noreferrer"',
		);
		expect(html).toContain(
			'href="https://linkedin.example.test/in/nadia" target="_blank" rel="me ugc nofollow noopener noreferrer"',
		);
	});

	it("leaves video blocks out until they can play (Phase 05)", () => {
		expect(html).not.toContain("dQw4w9WgXcQ");
	});

	it("shows contact, location and the credit", () => {
		expect(html).toContain("https://wa.me/6281255501824");
		expect(html).toContain(">+62 812 5550 1824</a>");
		expect(html).toContain('data-tz="Asia/Jakarta"');
		expect(html).toContain("Hybrid");
		expect(html).toContain("Bersedia relokasi");
		expect(html).toContain("© 2026 Nadia Rahmawati");
		expect(html).toContain('class="pf-badge" href="https://rezumi.example"');
	});

	it("computes contrast-safe accent tokens for light and dark", () => {
		expect(page.css).toMatch(/:root\{color-scheme:light;[^}]*--pf-accent:#0F766E/);
		expect(page.css).toMatch(/:root\[data-pf-scheme="dark"\]\{color-scheme:dark;/);
		expect(page.css).toContain("@font-face");
	});

	it("lists the resume icons it needs", () => {
		expect(portfolioIconNames(view)).toEqual([]);
	});

	it("wraps the page in a document with its head", () => {
		const document = renderPortfolioDocument({
			page,
			head: {
				title: "Nadia",
				description: "Designer <b>",
				canonicalUrl: "https://rezumi.example/nadia",
				indexable: false,
				imageUrl: "https://rezumi.example/cards/nadia.png",
				meLinks: ["https://linkedin.example.test/in/nadia"],
				structuredData: { name: "</script><script>alert(1)</script>" },
			},
		});
		expect(document).toMatch(/^<!doctype html><html lang="id-ID" dir="ltr" data-pf-scheme="light">/);
		expect(document).toContain('<meta name="robots" content="noindex, follow">');
		expect(document).toContain("Designer &lt;b&gt;");
		expect(document).toContain('<link rel="me" href="https://linkedin.example.test/in/nadia">');
		expect(document).not.toContain("</script><script>alert");
		expect(document).toContain('<meta name="theme-color" content="#FFFFFF">');
	});
});

describe("renderPortfolioPage edge cases", () => {
	it("draws an almost empty portfolio without empty headings", () => {
		const resume = testResume();
		resume.sections.experience.items = [];
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		resume.basics.location = "";
		resume.picture.url = "";
		const { html } = render({ about: { content: "" }, works: { items: [] } }, resume);
		expect(html).toContain("Nadia Rahmawati");
		expect(html).not.toContain('<section class="pf-section');
		expect(html).not.toContain("pf-nav__links");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("draws without a resume", () => {
		const { html } = render({ basics: { name: "Citra", headline: "Illustrator" } }, null);
		expect(html).toContain("Citra");
		expect(html).toContain("Illustrator");
	});

	it("sizes a very long name by its longest word", () => {
		const { html } = render({ basics: { name: "Muhammad Abdurrahmanwijayakusuma Putra" } });
		expect(html).toContain('style="--name-word:23"');
	});

	it("writes right-to-left pages", () => {
		const { html, page } = render(fullData, testResume(), "ar-SA");
		expect(page.dir).toBe("rtl");
		expect(page.lang).toBe("ar-SA");
		expect(html).toContain('class="pf-icon pf-flip"');
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("draws every Lugas variant", () => {
		const resume = testResume();
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
		for (const [key, values] of Object.entries({
			hero: ["photo-top", "photo-left"],
			work: ["list", "grid-2", "featured-grid"],
			services: ["list", "cards"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			skills: ["groups", "chips"],
			metric: ["big", "kpi", "ba"],
		}))
			for (const value of values) {
				const { html } = render({ ...fullData, design: { variants: { [key]: value } } }, resume);
				expect(html).toContain(`data-variant="${value}"`);
				expect(html).not.toMatch(/undefined|NaN/);
			}
	});

	it("draws a portfolio stored with a theme that has no renderer yet as Lugas", () => {
		const { html } = render({ ...fullData, theme: "kanvas" });
		expect(html).toContain('data-theme="lugas"');
		expect(html).toContain('data-variant="list"');
	});

	it("draws dark and device-following modes", () => {
		expect(render({ design: { scheme: "dark" } }).page.scheme).toBe("dark");
		expect(render({ design: { scheme: "auto" } }).page.css).toContain(
			'@media (prefers-color-scheme:dark){:root[data-pf-scheme="auto"]',
		);
	});
});
