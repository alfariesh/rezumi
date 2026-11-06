import type { PortfolioViewInput, PortfolioViewSection } from "./view";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { testResume } from "./fixtures.test-helpers";
import { buildPortfolioView, englishPortfolioViewMessages, resolveSectionOrder } from "./view";

const image = (name: string) => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	thumbKey: `uploads/user-1/pictures/portfolio/${name}-small.webp`,
	width: 1600,
	height: 1200,
	alt: "",
});

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
		messages: englishPortfolioViewMessages,
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
		const hidden = view({ hero: { showPicture: false } });
		expect(hidden.hero.picture).toBeNull();
		expect(hidden.basics.picture).not.toBeNull();
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
							{ id: "y", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ" },
							{ id: "p", type: "pdf", file: "uploads/user-1/documents/portfolio/deck.pdf", title: "Deck", pages: 12 },
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
		expect(work?.blocks[3]).toMatchObject({
			embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
			thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
		});
		expect(work?.blocks[4]).toMatchObject({
			href: "https://rezumi.example/uploads/user-1/documents/portfolio/deck.pdf",
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
