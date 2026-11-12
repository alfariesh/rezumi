import type { BentoTiles, TileSpan } from "./layout";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { count, expectSoundPage, testImage as image, renderTestPage, testResume } from "../../fixtures.test-helpers";
import { bentoAreas, workSpans } from "./layout";

const work = (index: number, cover = true) => ({
	id: `w${index}`,
	slug: `work-${index}`,
	title: `Work ${index}`,
	summary: `Summary ${index}`,
	...(cover ? { cover: image(`cover-${index}`) } : {}),
	blocks: [],
});

/** Every section and block type, every intro tile, and a profile to close the works with. */
const fullData: PortfolioDataInput = {
	theme: "mozaik",
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
	about: { content: "<p>I design <strong>calm</strong> apps.</p>" },
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
				blocks: [
					{ id: "b1", type: "text", html: "<p>Orders took too long.</p>" },
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
							},
						],
					},
					{ id: "b4", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ", title: "Checkout demo" },
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
						url: "https://medium.example.test/@nadia/post",
						title: "How we cut failed payments",
						siteName: "Medium",
					},
				],
			},
			work(2),
			work(3),
			work(4, false),
			work(5),
			work(6),
		],
	},
	services: { items: [{ id: "s1", title: "Design audit", description: "Fixes, in order.", price: "From Rp7.5m" }] },
	testimonials: {
		items: [{ id: "t1", quote: "Calm and clear.", name: "Damar Wicaksana", role: "Manager", consent: true }],
	},
	clients: { items: [{ id: "c1", name: "Kilau Pay" }] },
	custom: [{ id: "x1", title: "How I work", content: "<ol><li>Brief</li><li>Sketch</li></ol>", hidden: false }],
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

function resumeWithSkills(): ResumeData {
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
	resume.sections.education.items = [
		{
			id: "ed1",
			hidden: false,
			school: "Institut Teknologi Bandung",
			degree: "Bachelor",
			area: "Design",
			grade: "",
			location: "",
			period: "2013 – 2017",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["education"]["items"];
	resume.sections.languages.items = [
		{ id: "l1", hidden: false, language: "Bahasa Indonesia", fluency: "Native", level: 5 },
	] as ResumeData["sections"]["languages"]["items"];
	resume.sections.profiles.items.unshift({
		id: "pr0",
		hidden: false,
		icon: "",
		iconColor: "",
		network: "Behance",
		username: "nadia",
		website: { url: "https://behance.example.test/nadia", label: "", inlineLink: false },
	});
	return resume;
}

function render(data: PortfolioDataInput, resume: ResumeData | null = resumeWithSkills()) {
	return renderTestPage({ theme: "mozaik", ...data }, { resume });
}

/** A work's own page (`/nadia/work/<slug>`). */
function renderWork(data: PortfolioDataInput, workId: string, resume: ResumeData | null = resumeWithSkills()) {
	return renderTestPage({ theme: "mozaik", ...data }, { resume, page: { kind: "work", workId } });
}

/** The shared checks, and Mozaik's own main. */
function expectSoundStructure(html: string) {
	expectSoundPage(html, "mozaik");
	expect(html).toContain('<main class="pf-wrap mz-main" id="main"');
}

/** Whether CSS sparse auto-placement of these spans into `columns` leaves every row it touches full. */
function closesWithoutHoles(spans: TileSpan[], columns: number): boolean {
	const taken = new Set<string>();
	let row = 0;
	let column = 0;
	const free = (r: number, c: number, span: TileSpan) => {
		if (c + span.columns > columns) return false;
		for (let dr = 0; dr < span.rows; dr++)
			for (let dc = 0; dc < span.columns; dc++) if (taken.has(`${r + dr}:${c + dc}`)) return false;
		return true;
	};
	for (const span of spans) {
		while (!free(row, column, span)) {
			column++;
			if (column >= columns) {
				column = 0;
				row++;
			}
		}
		for (let dr = 0; dr < span.rows; dr++)
			for (let dc = 0; dc < span.columns; dc++) taken.add(`${row + dr}:${column + dc}`);
		column += span.columns;
	}
	const rows = Math.max(...[...taken].map((cell) => Number(cell.split(":")[0]))) + 1;
	return taken.size === rows * columns;
}

/** Whether a `grid-template-areas` value is valid: equal rows, and each name covers one rectangle. */
function isValidAreas(value: string, columns: number): boolean {
	const rows = [...value.matchAll(/"([^"]+)"/g)].map((match) => (match[1] as string).split(" "));
	if (rows.some((row) => row.length !== columns)) return false;
	for (const name of new Set(rows.flat())) {
		const cells = rows.flatMap((row, r) => row.flatMap((cell, c) => (cell === name ? [[r, c] as const] : [])));
		const rs = cells.map(([r]) => r);
		const cs = cells.map(([, c]) => c);
		const area = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
		if (area !== cells.length) return false;
	}
	return true;
}

describe("Mozaik layout", () => {
	it("closes the intro bento for every combination of missing tiles", () => {
		for (const photo of [true, false])
			for (const stats of [0, 1, 2] as const)
				for (const about of [true, false])
					for (const location of [true, false])
						for (const links of [true, false]) {
							const tiles: BentoTiles = { photo, stats, about, location, links };
							const areas = bentoAreas(tiles);
							const label = JSON.stringify(tiles);
							expect(isValidAreas(areas.wide, 4), label).toBe(true);
							expect(isValidAreas(areas.tablet, 2), label).toBe(true);
							expect(isValidAreas(areas.phone, 2), label).toBe(true);
							for (const [name, present] of [
								["photo", photo],
								["s1", stats > 0],
								["s2", stats === 2],
								["about", about],
								["loc", location],
								["links", links],
							] as const)
								for (const value of Object.values(areas))
									expect(value.includes(name), `${label} ${name}`).toBe(present);
						}
	});

	it("follows the spec's areas, and widens the intro without a photo", () => {
		const full = bentoAreas({ photo: true, stats: 2, about: true, location: true, links: true });
		expect(full.wide).toBe('"intro intro photo s1" "intro intro photo s2" "about about loc links"');
		expect(full.tablet).toBe('"intro intro" "photo s1" "photo s2" "about about" "loc links"');
		expect(full.phone).toBe('"intro intro" "photo s1" "photo s2" "about about" "loc loc" "links links"');
		expect(bentoAreas({ photo: false, stats: 2, about: true, location: true, links: true }).wide).toBe(
			'"intro intro intro s1" "intro intro intro s2" "about about loc links"',
		);
	});

	it("closes the works bento without holes for any number of works", () => {
		for (let works = 1; works <= 14; works++)
			for (const more of [true, false]) {
				const total = works + (more ? 1 : 0);
				const spans = workSpans(total, (index) => index === 5 || (more && index === works));
				expect(
					closesWithoutHoles(
						spans.map((span) => ({ ...span.wide })),
						4,
					),
					`${works} ${more}`,
				).toBe(true);
				expect(
					closesWithoutHoles(
						spans.map((span) => ({ ...span.tablet })),
						2,
					),
					`${works} ${more}`,
				).toBe(true);
			}
	});

	it("draws the spec's works bento: first 2 × 2, sixth and the closing tile 2 × 1", () => {
		const spans = workSpans(7, (index) => index === 5 || index === 6).map((span) => span.wide);
		expect(spans).toEqual([
			{ columns: 2, rows: 2 },
			{ columns: 1, rows: 1 },
			{ columns: 1, rows: 1 },
			{ columns: 1, rows: 1 },
			{ columns: 1, rows: 1 },
			{ columns: 2, rows: 1 },
			{ columns: 2, rows: 1 },
		]);
	});
});

describe("renderPortfolioPage (Mozaik)", () => {
	const { view, html } = render(fullData);

	it("draws every section with its anchor and heading", () => {
		expectSoundStructure(html);
		for (const anchor of [
			"about",
			"work",
			"services",
			"testimonials",
			"clients",
			"experience",
			"skills",
			"languages",
			"profiles",
			"custom-x1",
			"contact",
		])
			expect(count(html, new RegExp(`id="${anchor}"`, "g")), anchor).toBe(1);
	});

	it("puts About, the location card and the profile links in the intro bento, once", () => {
		const bento = /<section class="mz-bento"[^]*?<\/section><section class="pf-section mz-sec/.exec(html)?.[0] ?? "";
		expect(bento).toContain('class="mz-tile mz-about pf-section" id="about"');
		expect(bento).toContain('class="pf-loc" data-map=""');
		expect(bento).toContain('class="mz-tile mz-links pf-section" id="profiles"');
		expect(bento).toContain('href="https://behance.example.test/nadia" target="_blank" rel="me ugc nofollow');
		expect(bento).toContain('style="--mz-areas:&quot;intro intro photo s1&quot; &quot;intro intro photo s2&quot;');
		expect(count(html, /class="pf-loc"/g)).toBe(1);
		expect(count(html, /I design <strong>calm<\/strong> apps\./g)).toBe(1);
		// Contact keeps everything else: the note, the buttons and the list of ways to reach the person.
		const contact = html.slice(html.indexOf('id="contact"'));
		expect(contact).toContain("Let&#x27;s talk.");
		expect(contact).toContain("https://wa.me/6281255501824");
		expect(contact).toContain('class="pf-contact-links"');
		expect(contact).not.toContain("pf-loc");
	});

	it("draws one accent stat tile and one soft tile with the other highlights", () => {
		expect(html).toMatch(/<div class="mz-tile mz-stat mz-s1"><dl class="pf-metrics" data-variant="big">/);
		expect(html).toContain('<div class="mz-tile mz-stat mz-s2" data-count="2">');
		expect(html).toContain("Top 3");
	});

	it("draws the works bento with spans, caption pills and a closing tile to the main profile", () => {
		expect(html).toContain('<ul class="mz-works" data-variant="bento">');
		expect(html).toContain('style="--c:2;--r:2;--ct:2;--rt:2"');
		expect(count(html, /class="mz-work__cap"/g)).toBe(view.works.length);
		expect(html).toContain('<li class="mz-work" style="--c:1;--r:1;--ct:1;--rt:1" data-noimg="">');
		expect(html).toMatch(/<li class="mz-more"[^>]*><a href="https:\/\/behance\.example\.test\/nadia"/);
		expect(html).toContain("Selengkapnya di Behance");
		expect(html).toMatch(/<span class="pf-work-metric"><b>2,8%<\/b><span>Checkout conversion<\/span><\/span>/);
	});

	it("opens each work on its own page with every block type", () => {
		expect(html).not.toMatch(/pf-detail|pf-lightbox/);
		for (const item of view.works) expectSoundPage(renderWork(fullData, item.id).html, "mozaik");
		const detail = renderWork(fullData, "w1").html;
		expect(detail).toContain('class="pf-gallery"');
		expect(detail).toContain('class="pf-metrics" data-variant="kpi"');
		expect(detail).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"');
		expect(detail).toContain('class="pf-pdf"');
		expect(detail).toContain('class="pf-link"');
		expect(count(detail, /class="pf-lightbox"/g)).toBe(1);
	});

	it("draws every Mozaik variant in light and dark", () => {
		const { variants } = PORTFOLIO_THEME_INFO.mozaik;
		for (const scheme of ["light", "dark"] as const)
			for (const [key, values] of Object.entries(variants))
				for (const value of values) {
					const data = { ...fullData, design: { scheme, variants: { [key]: value } } };
					// A work's metrics, which take the metric variant, are on its own page.
					const { html: variantHtml, page } = key === "metric" ? renderWork(data, "w1") : render(data);
					expect(page.scheme).toBe(scheme);
					expectSoundStructure(variantHtml);
					if (key !== "hero") expect(variantHtml, `${key}=${value}`).toContain(`data-variant="${value}"`);
				}
	});

	it("draws the works as a grid of two without the bento's spans", () => {
		const { html: grid } = render({ ...fullData, design: { variants: { work: "grid-2" } } });
		expect(grid).toContain('<ul class="mz-works" data-variant="grid-2">');
		expect(grid).not.toContain("--c:");
		expect(grid).not.toContain("mz-more");
		expect(grid).toContain("Summary 2");
	});

	it("writes right-to-left pages", () => {
		const { html: rtl, page } = render({ ...fullData, locale: "ar-SA" });
		expect(page.dir).toBe("rtl");
		expectSoundStructure(rtl);
		expect(rtl).toContain('class="pf-icon pf-flip"');
	});

	it("sizes a very long name by its longest word", () => {
		const { html: long } = render({ ...fullData, basics: { name: "Muhammad Abdurrahmanwijayakusuma Putra" } });
		expect(long).toContain('class="pf-name mz-name" style="--name-word:23"');
	});
});

describe("renderPortfolioPage (Mozaik) with little content", () => {
	it("widens the intro over a missing photo and stats, with no empty headings", () => {
		const resume = testResume();
		resume.sections.experience.items = [];
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		resume.basics.location = "";
		resume.picture.url = "";
		const { html } = render({ about: { content: "" }, works: { items: [] } }, resume);
		expectSoundStructure(html);
		expect(html).toContain("Nadia Rahmawati");
		expect(html).not.toContain("mz-photo");
		expect(html).not.toContain("mz-stat");
		expect(html).toContain('style="--mz-areas:&quot;intro intro intro intro&quot;;');
		expect(html).not.toContain('<section class="pf-section');
		expect(html).not.toContain("pf-nav__links");
	});

	it("keeps the photo-less intro three columns wide beside the stats", () => {
		const { html } = render({ ...fullData, hero: { ...fullData.hero, showPicture: false } });
		expect(html).not.toContain("mz-photo");
		expect(html).toContain("&quot;intro intro intro s1&quot; &quot;intro intro intro s2&quot;");
	});

	it("shows a location with only a name as the intro's chip, not a tile", () => {
		const resume = resumeWithSkills();
		resume.sections.profiles.items = [];
		const { html } = render({ ...fullData, location: { label: "Bandung", showMap: false, workModes: [] } }, resume);
		expect(html).not.toContain("mz-loc");
		expect(html).toMatch(/<li class="pf-chip"><svg[^]*?<\/svg>Bandung<\/li>/);
	});

	it("leaves out the closing tile without a profile or website, and keeps a lone work's grid closed", () => {
		const resume = testResume();
		resume.sections.profiles.items = [];
		resume.basics.website = { url: "", label: "" };
		const { html } = render({ works: { items: [work(1)] } }, resume);
		expect(html).not.toContain("mz-more");
		expect(html).toContain('style="--c:4;--r:2;--ct:2;--rt:2"');
	});

	it("anchors Contact on the location tile when the location is all it has", () => {
		const resume = testResume();
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		const { html } = render({ ...fullData, contact: { whatsapp: { show: false, number: "" }, note: "" } }, resume);
		expectSoundStructure(html);
		expect(html).toContain('<section class="mz-tile mz-loc pf-section" id="contact" aria-labelledby="contact--title">');
		expect(html).not.toContain("mz-contact");
		expect(count(html, /id="contact"/g)).toBe(1);
	});
});
