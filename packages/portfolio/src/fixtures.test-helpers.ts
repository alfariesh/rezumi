import type { PortfolioPageKind, PortfolioPageLive } from "./page";
import type { PortfolioViewInput } from "./view";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { CustomSection, ProjectItem, ResumeData } from "@rezumi/schema/resume/data";
import { expect } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { renderPortfolioPage } from "./page";
import { buildPortfolioView, portfolioPageLocale } from "./view";

/** A fictional resume for portfolio tests. */
export function testResume(): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.basics = {
		...data.basics,
		name: "Nadia Rahmawati",
		headline: "Product Designer",
		email: "nadia@example.test",
		phone: "+62 812 0000 0000",
		location: "Bandung, Indonesia",
		website: { url: "https://nadia.example.test", label: "nadia.example.test" },
	};
	data.picture.url = "/uploads/user-1/pictures/formal.webp";
	data.summary.content = '<p>I design <strong style="color:red">calm</strong> apps.</p>';
	data.metadata.design.colors.primary = "rgba(15, 118, 110, 1)";
	data.metadata.page.locale = "id-ID";
	data.metadata.typography.heading.fontFamily = "Lora";
	data.metadata.typography.body.fontFamily = "Figtree";
	data.sections.projects.items = [
		project(
			"p1",
			"Aplikasi Kopi",
			"<p>Redesigned ordering for a coffee chain.</p>",
			"https://behance.example.test/kopi",
		),
		project("p2", "Hidden one", "<p>Not for the portfolio.</p>", "", true),
		project("p3", "", "", ""),
	];
	data.sections.experience.items = [
		{
			id: "e1",
			hidden: false,
			company: "Tokopedia",
			position: "Product Designer",
			location: "Jakarta",
			period: "2021 – now",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Checkout.</p>",
			roles: [],
		},
		{
			id: "e2",
			hidden: true,
			company: "Hidden Co",
			position: "Intern",
			location: "",
			period: "2019",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			roles: [],
		},
		{
			id: "e3",
			hidden: false,
			company: "Startup",
			position: "Designer",
			location: "",
			period: "2020",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			roles: [],
		},
	] as ResumeData["sections"]["experience"]["items"];
	data.sections.profiles.items = [
		{
			id: "pr1",
			hidden: false,
			icon: "linkedin-02",
			iconColor: "",
			network: "LinkedIn",
			username: "nadia",
			website: { url: "https://linkedin.example.test/in/nadia", label: "", inlineLink: false },
		},
	];
	data.sections.references.items = [
		{
			id: "r1",
			hidden: false,
			name: "Someone Else",
			position: "Manager",
			phone: "+62 800",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Call me.</p>",
		},
	] as ResumeData["sections"]["references"]["items"];
	return data;
}

function project(id: string, name: string, description: string, url: string, hidden = false): ProjectItem {
	return { id, hidden, name, period: "2024", website: { url, label: "", inlineLink: false }, description };
}

/**
 * A resume with every section the page reads filled (the sample resume's, with the test person's basics), a job with
 * roles, and custom sections of three kinds: a skills one with keywords, a languages one, and one whose ID a URL can't
 * hold as it is.
 */
export function fullTestResume(): ResumeData {
	const resume = structuredClone(sampleResumeData);
	const base = testResume();
	resume.basics = base.basics;
	resume.picture.url = base.picture.url;
	resume.metadata.page.locale = "id-ID";
	const [job] = resume.sections.experience.items;
	if (job)
		job.roles = [
			{ id: "role-1", position: "Senior Engineer", period: "2023 – now", description: "<p>Payments.</p>" },
			{ id: "role-2", position: "Engineer", period: "2021 – 2023", description: "" },
		] as typeof job.roles;
	const section = (id: string, type: CustomSection["type"], title: string, items: unknown[]) =>
		({
			id,
			type,
			title,
			icon: "",
			columns: 1,
			hidden: false,
			showHeading: true,
			keepTogether: false,
			startOnNewPage: false,
			items,
		}) as CustomSection;
	resume.customSections = [
		...resume.customSections,
		section("tools", "skills", "Tools", [
			{
				id: "k1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Design tools",
				proficiency: "Expert",
				level: 4,
				keywords: ["Figma", "Sketch"],
			},
		]),
		section("Bahasa daerah #1", "languages", "Local languages", [
			{ id: "l1", hidden: false, language: "Sundanese", fluency: "Native", level: 5 },
		]),
	];
	return resume;
}

/** A stored picture and its small copy, for test data. */
export const testImage = (name: string, width = 1600, height = 1200) => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	thumbKey: `uploads/user-1/pictures/portfolio/${name}-small.webp`,
	width,
	height,
	alt: `${name} picture`,
});

/** Every section and block type, with metrics using every optional part: the full page each theme draws. */
export const fullPortfolioData: PortfolioDataInput = {
	hero: {
		greeting: "I design calm apps for busy people.",
		availability: {
			show: true,
			text: "",
			roles: ["Product Designer", " UI Designer ", ""],
			types: ["full-time", "contract"],
		},
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
				previousSlugs: ["coffee-app", "kopi"],
				title: "Coffee ordering app",
				summary: "Ordering in three taps.",
				role: "Lead designer",
				date: "2024",
				tags: ["Mobile", "Research"],
				cover: { ...testImage("cover-1"), focus: { x: 0.3, y: 0.6 } },
				highlightMetricId: "m1",
				primaryLink: { label: "Case study", url: "https://behance.example.test/kopi" },
				blocks: [
					{ id: "b1", type: "text", html: "<h2>Problem</h2><h3>Why</h3><p>Orders took too long.</p>" },
					{
						id: "b2",
						type: "images",
						layout: "grid",
						images: [
							{ ...testImage("shot-1"), caption: "Home screen" },
							{ ...testImage("shot-2"), caption: "" },
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
					{
						id: "b4",
						type: "video",
						provider: "youtube",
						videoId: "dQw4w9WgXcQ",
						title: "Checkout demo",
						thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
						thumbnail: testImage("video-thumb", 480, 360),
					},
					{ id: "b5", type: "video", provider: "vimeo", videoId: "76979871", hash: "9f2c1a7b3d" },
					{
						id: "e1",
						type: "embed",
						provider: "figma",
						ref: "design/AbCdEf0123456789?node-id=1-2",
						title: "Checkout flow",
						thumbnail: testImage("figma-thumb", 1200, 630),
					},
					{ id: "e2", type: "embed", provider: "loom", ref: "0123456789abcdef0123456789abcdef", title: "Walkthrough" },
					{
						id: "e3",
						type: "embed",
						provider: "spotify",
						ref: "episode/4rOoJ6Egrf8K2IrywzwOMk",
						title: "Design podcast",
						thumbnail: testImage("spotify-thumb", 640, 640),
					},
					{ id: "e4", type: "embed", provider: "soundcloud", ref: "nadia/sets/interviews" },
					{ id: "e5", type: "embed", provider: "google-slides", ref: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" },
					{
						id: "b6",
						type: "pdf",
						file: "uploads/user-1/documents/portfolio/case-study.pdf",
						title: "Case study (public version)",
						pages: 12,
						bytes: 2_400_000,
						preview: testImage("case-study-page", 800, 1131),
					},
					{
						id: "b7",
						type: "link",
						url: "https://medium.example.test/@nadia/fewer-failed-payments",
						title: "How we cut failed payments",
						description: "Three experiments that mattered most.",
						siteName: "Medium",
						brandIcon: "medium",
					},
					{
						id: "b8",
						type: "link",
						url: "https://github.example.test/nadia/kopi",
						title: "nadia/kopi",
						image: testImage("repo-card", 1200, 600),
					},
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
			{ id: "c2", name: "", logo: testImage("logo", 600, 200) },
		],
	},
	custom: [{ id: "x1", title: "Product notes", content: "<p>Every Friday.</p>", hidden: false }],
	location: {
		label: "Jakarta, Indonesia",
		point: { lat: -6.2088, lng: 106.8456, precision: "city" },
		showMap: true,
		map: { light: testImage("map-light", 800, 480), dark: testImage("map-dark", 800, 480) },
		workModes: ["hybrid", "remote"],
		relocate: true,
		timezone: "Asia/Jakarta",
		showLocalTime: true,
	},
	contact: { whatsapp: { show: true, number: "6281255501824" }, note: "Let's talk.", saveContact: true },
};

type RenderTestPageOptions = {
	contactFormAvailable?: boolean;
	live?: PortfolioPageLive;
	/** The source resume; `testResume()` unless given, null for none. */
	resume?: ResumeData | null;
	/** The page's language, instead of the resume's. */
	locale?: string;
	/** The editor preview's open work (`PortfolioViewInput.openWorkId`). */
	openWorkId?: string;
	/** Resume icon shapes by name. */
	icons?: Record<string, string>;
	username?: string;
	/** Which page to draw (`RenderPortfolioPageInput.page`): the home page by default. */
	page?: PortfolioPageKind;
	/**
	 * The page's links. By default the server's on the app's domain: home `/<username>`, works at
	 * `/<username>/work/<slug>`, Save contact at `/api/portfolio/<username>/vcard`. `null` leaves the view's defaults
	 * (the editor's preview: `#main` and `#work-<slug>`, no Save contact).
	 */
	links?: PortfolioViewInput["links"] | null;
};

/** Renders test data as the server would: its own catalog, uploads on a test origin, the resume button public. */
export function renderTestPage(data: PortfolioDataInput, options: RenderTestPageOptions = {}) {
	const resume = options.resume === undefined ? testResume() : options.resume;
	const username = options.username ?? "nadia";
	const parsed = parseWritablePortfolioData(options.locale ? { ...data, locale: options.locale } : data);
	const messages = portfolioMessages(portfolioPageLocale(parsed, resume));
	const view = buildPortfolioView({
		portfolio: { data: parsed },
		resume: resume ? { data: resume } : null,
		owner: { name: "Account Name", username },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `https://rezumi.example/${key}`,
		links: {
			resume: "https://rezumi.example/nadia/cv",
			resumePdf: null,
			...(options.links === null
				? {}
				: (options.links ?? {
						home: `/${username}`,
						work: (slug: string) => `/${username}/work/${slug}`,
						vcard: `/api/portfolio/${username}/vcard`,
					})),
		},
		...(options.openWorkId ? { openWorkId: options.openWorkId } : {}),
		...(options.contactFormAvailable ? { contactFormAvailable: true } : {}),
	});
	const page = renderPortfolioPage({
		view,
		messages,
		year: 2026,
		creditUrl: "https://rezumi.example",
		imageUrl: (src) => (src.startsWith("/") ? `https://rezumi.example${src}` : src),
		icons: options.icons ?? {},
		...(options.live ? { live: options.live } : {}),
		...(options.page ? { page: options.page } : {}),
	});
	return { view, page, html: page.html, messages };
}

/** How often a pattern occurs in the markup. */
export const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

/** The readable text of a fragment of markup: pictures by their text, drawings and tags left out. */
function readableText(markup: string): string {
	return markup
		.replace(/<svg(?![^>]*role="img")[\s\S]*?<\/svg>/g, "")
		.replace(/<svg[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>/g, " $1 ")
		.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, " $1 ")
		.replace(/<[^>]+>/g, "")
		.trim();
}

/**
 * What every rendered page must be, whatever its theme, variant and language (`02-teknis.md` section 22): the theme's
 * root, one `h1`, no heading skipped or empty, ids unique, every `aria-labelledby` and `#link` landing on an element
 * that's there, every picture with a text alternative attribute, every link with a name and a safe new tab, no ARIA
 * name on an element that can't take one, no empty list item, no unstyled list outside rich text, and no undefined,
 * NaN or stray object in the text.
 */
export function expectSoundPage(html: string, theme?: string) {
	if (theme) expect(html).toMatch(new RegExp(`^<div class="pf" data-theme="${theme}"`));
	expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
	expect(count(html, /<h1[\s>]/g), "one h1").toBe(1);

	const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] as string);
	expect(
		ids.filter((id, index) => ids.indexOf(id) !== index),
		"duplicate ids",
	).toEqual([]);
	for (const [, id] of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
		const named = new RegExp(`<(h[1-6])[^>]* id="${id}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html);
		expect(readableText(named?.[2] ?? ""), `heading for ${id}`).not.toBe("");
	}
	for (const [, target] of html.matchAll(/href="#([^"]+)"/g))
		expect(ids, `#${target} lands nowhere`).toContain(decodeURIComponent(target as string));

	for (const [tag] of html.matchAll(/<img [^>]*>/g)) expect(tag, "picture without alt").toMatch(/ alt="/);
	for (const [, attributes, inner] of html.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)) {
		const named = /aria-label="[^"]+"/.test(attributes as string) || readableText(inner as string) !== "";
		expect(named, `link without a name: <a${attributes}>`).toBe(true);
		if (/target="_blank"/.test(attributes as string)) expect(attributes).toMatch(/rel="[^"]*noopener/);
	}
	expect(html, "ARIA name on a generic element").not.toMatch(/<(?:p|span|div|b|i)\s(?![^>]*\brole=)[^>]*aria-label=/);
	expect(html, "empty list item").not.toMatch(/<li[^>]*><\/li>/);
	expect(html.replace(/<div class="pf-prose[^"]*">[\s\S]*?<\/div>/g, ""), "unstyled list").not.toMatch(/<[uo]l>/);

	const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));
	for (let index = 1; index < levels.length; index++)
		expect(levels[index] as number, "heading level skipped").toBeLessThanOrEqual((levels[index - 1] as number) + 1);
	expect(html, "empty heading").not.toMatch(/<h([1-6])[^>]*>\s*<\/h\1>/);
}
