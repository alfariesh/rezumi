import type { PortfolioViewInput, PortfolioViewSection } from "./view";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { CustomSection, ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isPortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import { testResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { buildPortfolioView, resolvePortfolioWork, resolveSectionOrder } from "./view";

const englishMessages = portfolioViewMessages(portfolioMessages("en-US"));

const image = (name: string) => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	thumbKey: `uploads/user-1/pictures/portfolio/${name}-small.webp`,
	width: 1600,
	height: 1200,
	alt: "",
});

/** A resume custom section, with the fields the resume schema gives every section. */
const customSection = (id: string, type: CustomSection["type"], title: string, items: unknown[], hidden = false) =>
	({
		id,
		type,
		title,
		icon: "",
		columns: 1,
		hidden,
		showHeading: true,
		keepTogether: false,
		startOnNewPage: false,
		items,
	}) as CustomSection;

function view(
	data: PortfolioDataInput = {},
	overrides: Omit<Partial<PortfolioViewInput>, "resume"> & { resume?: ResumeData | null } = {},
) {
	const { resume = testResume(), ...rest } = overrides;
	return buildPortfolioView({
		portfolio: { data: parseWritablePortfolioData(data) },
		resume: resume ? { data: resume } : null,
		owner: { name: "Account Name", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: englishMessages,
		fileUrl: (key) => `https://rezumi.example/${key}`,
		...rest,
	});
}

const section = <K extends PortfolioViewSection["kind"]>(sections: PortfolioViewSection[], kind: K) =>
	sections.find((item): item is Extract<PortfolioViewSection, { kind: K }> => item.kind === kind);

describe("buildPortfolioView basics", () => {
	it("takes basics, language, accent and fonts from the source resume", () => {
		const result = view({ design: { fonts: { source: "resume" } } });
		expect(result.basics).toMatchObject({
			name: "Nadia Rahmawati",
			headline: "Product Designer",
			location: "Bandung, Indonesia",
			picture: { src: "/uploads/user-1/pictures/formal.webp", alt: "Nadia Rahmawati" },
			initials: "NR",
			longestWord: 9,
		});
		expect(result.locale).toBe("id-ID");
		expect(result.dir).toBe("ltr");
		expect(result.design.accent).toBe("#0F766E");
		expect(result.design.fonts).toMatchObject({ heading: "Lora", body: "Figtree", pair: null });
	});

	it("prefers the portfolio's own basics, and null means no photo", () => {
		const own = view({
			basics: { name: "Nadia R.", headline: "UI Designer", picture: image("casual"), location: "Bali" },
		});
		expect(own.basics).toMatchObject({ name: "Nadia R.", headline: "UI Designer", location: "Bali" });
		expect(own.basics.picture).toMatchObject({
			src: "https://rezumi.example/uploads/user-1/pictures/portfolio/casual.webp",
			srcSmall: "https://rezumi.example/uploads/user-1/pictures/portfolio/casual-small.webp",
			alt: "Nadia R.",
		});
		expect(view({ basics: { picture: null } }).basics.picture).toBeNull();
	});

	it("shows no photo anywhere when the intro shows none, so the share card and search engines don't get it", () => {
		for (const basics of [{}, { picture: image("casual") }]) {
			const hidden = view({ basics, hero: { showPicture: false } });
			expect(hidden.hero.picture).toBeNull();
			expect(hidden.basics.picture).toBeNull();
		}
	});

	it("works without a resume: own basics, then the account's name, and no career sections", () => {
		const result = view({ design: { accent: { source: "resume" }, fonts: { source: "resume" } } }, { resume: null });
		expect(result.basics).toMatchObject({ name: "Account Name", headline: "", location: "", picture: null });
		expect(result.locale).toBe("en-US");
		expect(result.design.accent).toBe("#1D4ED8");
		expect(result.design.fonts).toMatchObject({ heading: "Plus Jakarta Sans", pair: "jakarta" });
		expect(result.sections.map((item) => item.kind)).toEqual([]);
		expect(view({ basics: { name: "Bayu" } }, { resume: null }).basics.name).toBe("Bayu");
	});

	it("falls back to the theme's fonts when the resume's can't load on the web", () => {
		const resume = testResume();
		resume.metadata.typography.heading.fontFamily = "My Upload";
		resume.metadata.typography.customFonts = [
			{ family: "My Upload", weight: "400", style: "normal", url: "/uploads/user-1/fonts/a.ttf" },
		] as unknown as ResumeData["metadata"]["typography"]["customFonts"];
		expect(view({ theme: "kanvas", design: { fonts: { source: "resume" } } }, { resume }).design.fonts).toMatchObject({
			heading: "Archivo",
			nameStretch: "72%",
			nameUppercase: true,
		});
		const standard = testResume();
		standard.metadata.typography.body.fontFamily = "Helvetica";
		expect(view({ design: { fonts: { source: "resume" } } }, { resume: standard }).design.fonts.pair).toBe("jakarta");
	});

	it("uses the theme's choices where the portfolio made none, and its own where the theme allows", () => {
		const kanvas = view({ theme: "kanvas" });
		expect(kanvas.design).toMatchObject({
			scheme: "dark",
			effect: { id: "vector-hover", target: "name" },
			variants: { hero: "big-name", work: "featured-grid", metric: "big" },
		});
		const prima = view({
			theme: "prima",
			design: { scheme: "auto", variants: { work: "list", hero: "bento", metric: "ba" } },
			hero: { effect: { id: "gradient" } },
		});
		expect(prima.design.scheme).toBe("auto");
		expect(prima.design.variants).toMatchObject({ work: "list", hero: "photo-right", metric: "ba" });
		expect(prima.design.effect.id).toBe("none");
	});
});

describe("buildPortfolioView sections", () => {
	it("reads career sections live, without items hidden in the resume or on the portfolio, and never references", () => {
		const result = view({ sections: { hiddenItems: { experience: ["e3"] } } });
		expect(section(result.sections, "experience")?.items.map((item) => item.id)).toEqual(["e1"]);
		expect(JSON.stringify(result)).not.toContain("Someone Else");
	});

	it("leaves out empty and hidden sections and uses custom titles", () => {
		const result = view({
			about: { content: "<p>Hello</p>" },
			sections: { hidden: ["experience"], titles: { about: "Tentang saya" } },
		});
		expect(result.sections.map((item) => item.kind)).toEqual(["about", "profiles", "contact"]);
		expect(section(result.sections, "about")).toMatchObject({ title: "Tentang saya", anchor: "about" });
		expect(view({ about: { content: "<p> </p>" } }).sections.map((item) => item.kind)).not.toContain("about");
	});

	it("orders sections the portfolio's way, filling in the rest where the theme puts them", () => {
		const data = parseWritablePortfolioData({
			sections: { order: ["contact", "work"] },
			custom: [{ id: "c1", title: "Principles", content: "<p>Be kind.</p>" }],
		});
		const resume = testResume();
		resume.customSections = [
			{ id: "cs1", type: "awards", title: "Grants", items: [] },
			{ id: "cs2", type: "cover-letter", title: "Letters", items: [] },
		] as unknown as ResumeData["customSections"];
		const order = resolveSectionOrder(data, "lugas", resume);
		expect(order.slice(0, 3)).toEqual(["about", "custom:c1", "resume:cs1"]);
		expect(order.indexOf("custom:c1")).toBeLessThan(order.indexOf("contact"));
		expect(order.indexOf("services")).toBe(order.indexOf("work") + 1);
		expect(order).not.toContain("resume:cs2");
		expect(resolveSectionOrder(parseWritablePortfolioData({}), "kanvas", null)[0]).toBe("work");
	});

	it("shows works that aren't hidden, with their blocks ready to draw", () => {
		const result = view({
			works: {
				items: [
					{
						id: "w1",
						slug: "kopi",
						title: "Kopi",
						cover: { ...image("cover"), focus: { x: 0.2, y: 0.8 } },
						highlightMetricId: "m1",
						blocks: [
							{ id: "t", type: "text", html: "<p>Story</p>" },
							{ id: "empty", type: "text", html: "<p></p>" },
							{
								id: "m",
								type: "metrics",
								items: [{ id: "m1", label: "Conversion", value: { kind: "number", number: 35 }, format: "percent" }],
							},
							{ id: "v", type: "video", provider: "vimeo", videoId: "76979871", hash: "9f2c1a7b3d" },
							{
								id: "y",
								type: "video",
								provider: "youtube",
								videoId: "dQw4w9WgXcQ",
								thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
								thumbnail: { key: "uploads/user-1/pictures/portfolio/thumb.webp", width: 480, height: 360, alt: "" },
							},
							{
								id: "p",
								type: "pdf",
								file: "uploads/user-1/documents/portfolio/deck.pdf",
								title: "Deck",
								pages: 12,
								bytes: 2_400_000,
							},
						],
					},
					{ id: "w2", slug: "secret", title: "Secret", hidden: true },
				],
			},
		});
		expect(result.works.map((work) => work.slug)).toEqual(["kopi"]);
		const [work] = result.works;
		expect(work).toMatchObject({
			anchor: "work-kopi",
			cover: { focus: { x: 0.2, y: 0.8 } },
			highlight: { id: "m1", label: "Conversion" },
		});
		expect(work?.blocks.map((block) => block.id)).toEqual(["t", "m", "v", "y", "p"]);
		expect(work?.blocks[2]).toMatchObject({
			href: "https://vimeo.com/76979871/9f2c1a7b3d",
			embedUrl: "https://player.vimeo.com/video/76979871?dnt=1&autoplay=1&h=9f2c1a7b3d",
			thumbnail: null,
		});
		// The page shows the stored copy of a thumbnail, never YouTube's own address.
		expect(work?.blocks[3]).toMatchObject({
			embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
			thumbnail: { src: "https://rezumi.example/uploads/user-1/pictures/portfolio/thumb.webp" },
		});
		expect(work?.blocks[4]).toMatchObject({
			href: "https://rezumi.example/uploads/user-1/documents/portfolio/deck.pdf",
			bytes: 2_400_000,
		});
	});
});

describe("buildPortfolioView contact and buttons", () => {
	it("shows contact details by the portfolio's settings, not the resume's", () => {
		const defaults = section(view().sections, "contact")?.contact;
		expect(defaults).toMatchObject({
			email: "nadia@example.test",
			phone: null,
			website: { href: "https://nadia.example.test", label: "nadia.example.test" },
			whatsapp: null,
			form: false,
			profiles: [{ network: "LinkedIn", href: "https://linkedin.example.test/in/nadia" }],
		});
		const chosen = section(
			view({
				contact: {
					email: false,
					phone: true,
					website: false,
					profiles: false,
					form: true,
					whatsapp: { show: true, number: "6281200000000" },
				},
			}).sections,
			"contact",
		)?.contact;
		expect(chosen).toMatchObject({
			email: null,
			phone: "+62 812 0000 0000",
			website: null,
			profiles: [],
			form: false,
			whatsapp: { href: "https://wa.me/6281200000000" },
		});
		expect(
			section(view({ contact: { form: true } }, { contactFormAvailable: true }).sections, "contact")?.contact.form,
		).toBe(true);
	});

	it("resolves buttons to addresses and leaves out the ones that have none", () => {
		const buttons = [{ kind: "resume" }, { kind: "pdf", label: "CV (PDF)" }, { kind: "contact" }] as const;
		expect(view({ hero: { buttons: [...buttons] } }).hero.buttons).toEqual([
			{ label: "Send a message", href: "#contact", external: false, kind: "contact" },
		]);
		expect(
			view(
				{ hero: { buttons: [...buttons] } },
				{ links: { resume: "/nadia/cv", resumePdf: "/api/resumes/nadia/cv.pdf" } },
			).hero.buttons,
		).toEqual([
			{ label: "View resume", href: "/nadia/cv", external: false, kind: "resume" },
			{ label: "CV (PDF)", href: "/api/resumes/nadia/cv.pdf", external: false, kind: "pdf" },
			{ label: "Send a message", href: "#contact", external: false, kind: "contact" },
		]);
		expect(view({ hero: { buttons: [{ kind: "whatsapp" }, { kind: "link" }] } }).hero.buttons).toEqual([]);
	});

	it("starts a service's WhatsApp order with a message about it", () => {
		const services = section(
			view({
				contact: { whatsapp: { show: false, number: "6281200000000" } },
				services: { items: [{ id: "s", title: "Logo design", cta: { kind: "whatsapp" } }] },
			}).sections,
			"services",
		)?.services;
		expect(services?.[0]?.cta?.href).toBe(
			`https://wa.me/6281200000000?text=${encodeURIComponent("Hello, I'm interested in your service: Logo design")}`,
		);
	});

	it("only drops the credit when the plan allows it", () => {
		expect(view({ credit: { show: false } }).credit).toBe(true);
		expect(view({ credit: { show: false } }, { entitlements: { hidePortfolioCredit: true } }).credit).toBe(false);
		expect(view({}, { entitlements: { hidePortfolioCredit: true } }).credit).toBe(true);
	});

	it("writes a title and description when the portfolio sets none", () => {
		expect(view().seo).toEqual({ title: "Nadia Rahmawati — Product Designer", description: "Product Designer" });
		expect(view({ hero: { greeting: "I design calm apps." } }).seo.description).toBe("I design calm apps.");
		expect(view({ seo: { title: "Nadia", description: "Designer in Bandung" } }).seo).toEqual({
			title: "Nadia",
			description: "Designer in Bandung",
		});
	});

	it("shows Open to work in the page's words unless the portfolio has its own", () => {
		expect(view({ hero: { availability: { show: true } } }).hero.availability).toBe("Open to work");
		expect(view({ hero: { availability: { show: true, text: "Taking freelance work" } } }).hero.availability).toBe(
			"Taking freelance work",
		);
		expect(view().hero.availability).toBeNull();
	});
});

describe("buildPortfolioView keeps what's hidden hidden", () => {
	it("leaves out resume sections hidden as a whole, standard and custom, and profiles hidden in the resume", () => {
		const resume = testResume();
		resume.sections.experience.hidden = true;
		resume.sections.profiles.hidden = true;
		resume.customSections = [
			customSection(
				"private",
				"experience",
				"Private work",
				[{ id: "x1", hidden: false, company: "Secret Employer", position: "Moonlighting", period: "2025" }],
				true,
			),
			customSection("shown", "awards", "Grants", [{ id: "g1", hidden: false, title: "Design grant" }]),
		];
		const result = view({ sections: { hidden: [] } }, { resume });
		const kinds = result.sections.map((item) => item.kind);
		expect(kinds).not.toContain("experience");
		expect(kinds).not.toContain("profiles");
		expect(result.sections.map((item) => item.key)).toEqual(expect.arrayContaining(["resume:shown"]));
		expect(JSON.stringify(result)).not.toContain("Secret Employer");
		expect(section(result.sections, "contact")?.contact.profiles).toEqual([]);
	});

	it("publishes no work detail while the Work section is hidden, except the work the editor has open", () => {
		const secret = { id: "w1", slug: "secret", title: "Secret client", summary: "Confidential" };
		const works = { items: [secret, { id: "w2", slug: "draft", title: "  " }] };
		const hidden = view({ works, sections: { hidden: ["work"] } });
		expect(hidden.sections.some((item) => item.kind === "work")).toBe(false);
		expect(hidden.works).toEqual([]);
		// The editor's preview keeps the detail of the work being edited, even an untitled one.
		expect(view({ works, sections: { hidden: ["work"] } }, { openWorkId: "w1" }).works.map((w) => w.id)).toEqual([
			"w1",
		]);
		expect(view({ works }, { openWorkId: "w2" }).works.map((w) => w.id)).toEqual(["w1", "w2"]);
		expect(view({ works: { items: [{ ...secret, hidden: true }] } }, { openWorkId: "w1" }).works).toEqual([]);
	});

	it("leaves out works without a title, and trims the ones it shows", () => {
		const result = view({
			works: {
				items: [
					{ id: "w1", slug: "a", title: "" },
					{ id: "w2", slug: "b", title: "  Kopi  " },
				],
			},
		});
		expect(result.works.map((work) => work.title)).toEqual(["Kopi"]);
		expect(section(result.sections, "work")?.works.map((work) => work.id)).toEqual(["w2"]);
	});

	it("points no button at Contact when the page doesn't show it", () => {
		const data = {
			hero: { buttons: [{ kind: "contact" as const }] },
			services: { items: [{ id: "s", title: "Logo", cta: { kind: "contact" as const } }] },
			custom: [{ id: "c1", title: "Note", content: "<p>Hi</p>", button: { kind: "contact" as const } }],
		};
		expect(view(data).hero.buttons.map((button) => button.href)).toEqual(["#contact"]);
		const hidden = view({ ...data, sections: { hidden: ["contact"] } });
		expect(hidden.hero.buttons).toEqual([]);
		expect(section(hidden.sections, "services")?.services[0]?.cta).toBeNull();
		expect(section(hidden.sections, "custom")?.button).toBeNull();
	});
});

describe("buildPortfolioView makes what it takes from the resume safe", () => {
	it("links only to http(s) addresses, giving a bare domain https://", () => {
		const resume = testResume();
		const profile = resume.sections.profiles.items[0];
		if (!profile) throw new Error("The test resume has a profile.");
		resume.sections.profiles.items = [
			{ ...profile, id: "a", network: "GitHub", website: { ...profile.website, url: "github.com/nadia" } },
			{ ...profile, id: "b", network: "Evil", website: { ...profile.website, url: "javascript:alert(1)" } },
			{ ...profile, id: "c", network: "Relative", website: { ...profile.website, url: "//evil.example.test/x" } },
			{ ...profile, id: "d", network: "Data", website: { ...profile.website, url: "data:text/html,hi" } },
		];
		resume.sections.experience.items = resume.sections.experience.items.map((item) => ({
			...item,
			website: { ...item.website, url: "file:///etc/passwd" },
		}));
		resume.basics.website = { url: "javascript:alert(1)", label: "Home" };
		const result = view({ sections: { hidden: [] } }, { resume });
		const contact = section(result.sections, "contact")?.contact;
		expect(contact?.website).toBeNull();
		expect(contact?.profiles.map((item) => item.href)).toEqual(["https://github.com/nadia", null, null, null]);
		expect(section(result.sections, "profiles")?.items.map((item) => item.website.url)).toEqual([
			"https://github.com/nadia",
			"",
			"",
			"",
		]);
		expect(section(result.sections, "experience")?.items.every((item) => item.website.url === "")).toBe(true);
		expect(JSON.stringify(result)).not.toMatch(/javascript:|file:|data:text|\/\/evil/);
	});

	it("keeps a resume website that is a full address as it is", () => {
		const resume = testResume();
		resume.basics.website = { url: "http://nadia.example.test/about?x=1", label: "" };
		expect(section(view({}, { resume }).sections, "contact")?.contact.website?.href).toBe(
			"http://nadia.example.test/about?x=1",
		);
	});

	it("rounds the location's point to the precision the person chose", () => {
		const location = (precision: "city" | "region" | "country") =>
			view({ location: { label: "Bandung", point: { lat: -6.917_464, lng: 107.619_123, precision } } }).location?.point;
		expect(location("city")).toEqual({ lat: -6.92, lng: 107.62, precision: "city" });
		// A region or country can't name a city: whole degrees, even from a city's own point saved by older data.
		expect(location("region")).toEqual({ lat: -7, lng: 108, precision: "region" });
		expect(location("country")).toEqual({ lat: -7, lng: 108, precision: "country" });
	});

	it("gives every section an anchor that is safe and unique, whatever the resume's IDs", () => {
		const resume = testResume();
		const award = (title: string) => [{ id: title, hidden: false, title }];
		resume.customSections = [
			customSection("0193-abc", "awards", "Plain", award("one")),
			customSection('A "quoted" id', "awards", "Quoted", award("two")),
			customSection("a--title", "awards", "Dashes", award("three")),
			customSection("#hash</h2>", "awards", "Markup", award("four")),
			customSection("dup", "awards", "First", award("five")),
			customSection("dup", "awards", "Second", award("six")),
			customSection("", "awards", "Empty id", award("seven")),
			customSection("x".repeat(PORTFOLIO_LIMITS.text.id + 1), "awards", "Too long", award("eight")),
		];
		const result = view({}, { resume });
		const anchors = result.sections.map((item) => item.anchor);
		expect(new Set(anchors).size).toBe(anchors.length);
		for (const anchor of anchors) expect(anchor).toMatch(/^[\da-z]+(?:-[\da-z]+)*$/i);
		expect(anchors).toContain("resume-0193-abc");
		expect(result.sections.filter((item) => item.kind === "resume").map((item) => item.title)).toEqual([
			"Plain",
			"Quoted",
			"Dashes",
			"Markup",
			"First",
		]);
		// The same ID always gives the same anchor, so a shared link keeps working.
		expect(view({}, { resume }).sections.map((item) => item.anchor)).toEqual(anchors);
		// The editor only ever stores keys the server takes.
		for (const key of resolveSectionOrder(parseWritablePortfolioData({}), "lugas", resume))
			expect(isPortfolioSectionKey(key), key).toBe(true);
	});
});

describe("buildPortfolioView choices", () => {
	it("puts featured works first in layouts that draw the first work larger, and keeps the order elsewhere", () => {
		const works = {
			items: [
				{ id: "w1", slug: "a", title: "First" },
				{ id: "w2", slug: "b", title: "Second", featured: true },
				{ id: "w3", slug: "c", title: "Third" },
				{ id: "w4", slug: "d", title: "Fourth", featured: true },
			],
		};
		const order = (data: PortfolioDataInput) => view({ works, ...data }).works.map((work) => work.id);
		expect(order({ theme: "lugas", design: { variants: { work: "featured-grid" } } })).toEqual([
			"w2",
			"w4",
			"w1",
			"w3",
		]);
		expect(order({ theme: "kanvas" })).toEqual(["w2", "w4", "w1", "w3"]);
		expect(order({ theme: "mozaik" })).toEqual(["w2", "w4", "w1", "w3"]);
		expect(order({ theme: "lugas" })).toEqual(["w1", "w2", "w3", "w4"]);
		expect(order({ theme: "prima" })).toEqual(["w1", "w2", "w3", "w4"]);
		expect(order({ theme: "mozaik", design: { variants: { work: "grid-2" } } })).toEqual(["w1", "w2", "w3", "w4"]);
	});

	it("cuts a description made from About to the length search engines show", () => {
		const description = view({ about: { content: `<p>${"word ".repeat(100)}</p>` } }).seo.description;
		expect(description.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.text.seoDescription);
		expect(description.endsWith("…")).toBe(true);
	});
});

describe("buildPortfolioView for Phase 13", () => {
	const works = {
		items: [
			{ id: "w1", slug: "kopi-app", title: "Coffee app", previousSlugs: ["coffee-app", "shared"], blocks: [] },
			{ id: "w2", slug: "shared", title: "Second", previousSlugs: ["old-second"], blocks: [] },
			{ id: "w3", slug: "secret", title: "Hidden", hidden: true, previousSlugs: ["old-secret"], blocks: [] },
			{ id: "w4", slug: "untitled", title: "  ", blocks: [] },
		],
	};

	it("gives each listed work its page's address, the view's default or the server's", () => {
		expect(view({ works }).works.map((work) => work.href)).toEqual(["#work-kopi-app", "#work-shared"]);
		expect(view({ works }).homeUrl).toBe("#main");
		const served = view({ works }, { links: { home: "/nadia", work: (slug) => `/nadia/work/${slug}` } });
		expect(served.works.map((work) => work.href)).toEqual(["/nadia/work/kopi-app", "/nadia/work/shared"]);
		expect(served.homeUrl).toBe("/nadia");
	});

	it("finds a work's page by its address: the current one, an old one that moved, never a hidden work's", () => {
		const built = view({ works });
		expect(resolvePortfolioWork(built, "kopi-app")).toMatchObject({ status: "ok", work: { id: "w1" } });
		expect(resolvePortfolioWork(built, "coffee-app")).toEqual({ status: "moved", slug: "kopi-app" });
		// A slug in use wins over another work's old one.
		expect(resolvePortfolioWork(built, "shared")).toMatchObject({ status: "ok", work: { id: "w2" } });
		expect(resolvePortfolioWork(built, "secret")).toBeNull();
		expect(resolvePortfolioWork(built, "old-secret")).toBeNull();
		expect(resolvePortfolioWork(built, "untitled")).toBeNull();
		expect(resolvePortfolioWork(view({ works, sections: { hidden: ["work"] } }), "kopi-app")).toBeNull();
	});

	it("says what the person is looking for only while Open to work is on and says something", () => {
		const hero = (availability: object) => view({ hero: { availability } }).hero.openTo;
		expect(hero({ show: true, roles: [" Designer ", ""], types: ["contract"] })).toEqual({
			roles: ["Designer"],
			types: ["contract"],
		});
		expect(hero({ show: false, roles: ["Designer"], types: ["contract"] })).toBeNull();
		expect(hero({ show: true, roles: [" "], types: [] })).toBeNull();
	});

	it("offers Save contact only where the page has the card's address, and never keeps Contact for it alone", () => {
		const vcard = "/api/portfolio/nadia/vcard";
		const data = { hero: { buttons: [{ kind: "vcard" as const }] }, contact: { email: true, saveContact: true } };
		const withCard = view(data, { links: { vcard } });
		expect(withCard.hero.buttons).toEqual([{ label: "Save contact", href: vcard, external: false, kind: "vcard" }]);
		expect(section(withCard.sections, "contact")?.contact.vcard).toBe(vcard);
		expect(view(data).hero.buttons).toEqual([]);
		expect(
			section(
				view({ ...data, contact: { ...data.contact, saveContact: false } }, { links: { vcard } }).sections,
				"contact",
			)?.contact.vcard,
		).toBeNull();
		const bare = testResume();
		bare.basics.email = "";
		bare.basics.phone = "";
		bare.basics.website = { url: "", label: "" };
		bare.basics.location = "";
		bare.sections.profiles.items = [];
		expect(
			section(
				view({ contact: { saveContact: true, whatsapp: { show: false } } }, { links: { vcard }, resume: bare })
					.sections,
				"contact",
			),
		).toBeUndefined();
	});
});
