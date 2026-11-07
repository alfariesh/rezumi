import type { PortfolioViewContact, PortfolioViewLocation, PortfolioViewSection } from "../../view";
import type { ContactSection, ProfileLink } from "./data";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { renderTestPage, testResume } from "../../fixtures.test-helpers";
import {
	blocksOf,
	contactOf,
	displayUrl,
	hasContactBody,
	locationTileOf,
	moreLink,
	navigationSections,
	profileLinks,
	sectionsBelowIntro,
} from "./data";

const LOCATION: PortfolioViewLocation = {
	label: "Denpasar, Bali",
	point: null,
	map: null,
	workModes: [],
	relocate: false,
	timezone: null,
	showLocalTime: false,
};

const EMPTY_CONTACT: PortfolioViewContact = {
	note: "",
	email: null,
	phone: null,
	website: null,
	whatsapp: null,
	profiles: [],
	form: false,
	location: null,
};

const contactSection = (contact: Partial<PortfolioViewContact>): ContactSection => ({
	kind: "contact",
	key: "contact",
	anchor: "contact",
	title: "Contact",
	contact: { ...EMPTY_CONTACT, ...contact },
});

/** A section with only what the block layout looks at. */
const section = (kind: string) => ({ kind, key: kind, anchor: kind, title: kind }) as PortfolioViewSection;

const link = (key: string, network: string, href: string | null): ProfileLink => ({
	key,
	label: network,
	network,
	href,
});

describe("Mozaik's contact in the intro", () => {
	it("keeps a contact section below the intro only when it has more than its location", () => {
		expect(hasContactBody(undefined)).toBe(false);
		expect(hasContactBody(contactSection({ location: LOCATION }))).toBe(false);
		// A profile without an address draws nothing, so it doesn't count.
		const profile = { id: "p", network: "Dribbble", username: "citra", icon: "", href: null };
		expect(hasContactBody(contactSection({ profiles: [profile] }))).toBe(false);
		expect(hasContactBody(contactSection({ profiles: [{ ...profile, href: "https://dribbble.example.test" }] }))).toBe(
			true,
		);
		for (const filled of [
			{ note: "Let's talk." },
			{ email: "citra@example.test" },
			{ phone: "+62 800" },
			{ whatsapp: { number: "6280", href: "https://wa.me/6280" } },
			{ website: { label: "citra.example.test", href: "https://citra.example.test", external: true } },
			{ form: true },
		])
			expect(hasContactBody(contactSection(filled)), JSON.stringify(filled)).toBe(true);
	});

	it("moves a telling location card into the intro, and a name alone only when it is all Contact has", () => {
		expect(locationTileOf(undefined)).toBeNull();
		expect(locationTileOf(contactSection({ note: "Hi" }))).toBeNull();
		// A name with something else to show in Contact reads better as the intro's chip.
		expect(locationTileOf(contactSection({ note: "Hi", location: LOCATION }))).toBeNull();
		// A name alone, with nothing else in Contact, holds #contact as a tile.
		expect(locationTileOf(contactSection({ location: LOCATION }))).toBe(LOCATION);
		for (const telling of [{ workModes: ["remote" as const] }, { relocate: true }, { showLocalTime: true }]) {
			const location = { ...LOCATION, ...telling };
			expect(locationTileOf(contactSection({ note: "Hi", location })), JSON.stringify(telling)).toBe(location);
		}
	});
});

describe("Mozaik's profile links", () => {
	const data: PortfolioDataInput = { theme: "mozaik", contact: { profiles: true, website: true } };

	it("lists the contact's profiles, then the Profiles section's, then the website, each address once", () => {
		const resume = testResume();
		const profile = resume.sections.profiles.items[0];
		if (!profile) throw new Error("The test resume has a profile.");
		resume.sections.profiles.items = [
			profile,
			{
				...profile,
				id: "pr2",
				network: "",
				username: "",
				website: { ...profile.website, url: "https://x.example.test/n" },
			},
			// Contact leaves out a profile without a network or address; the Profiles section still lists it.
			{ ...profile, id: "pr3", network: "", username: "citra.m", website: { ...profile.website, url: "" } },
			{ ...profile, id: "pr4", network: "", username: "", website: { ...profile.website, url: "" } },
		];
		const { view, messages } = renderTestPage(data, { resume });
		const profiles = view.sections.find((item) => item.kind === "profiles");
		const links = profileLinks(view, profiles?.kind === "profiles" ? profiles : undefined, messages.website);
		expect(links).toEqual([
			{ key: "pr1", label: "LinkedIn", network: "LinkedIn", href: "https://linkedin.example.test/in/nadia" },
			// Without a network or username, the site names it.
			{ key: "pr2", label: "x.example.test", network: "", href: "https://x.example.test/n" },
			{ key: "pr3", label: "citra.m", network: "", href: null },
			{ key: "website", label: messages.website, network: "", href: "https://nadia.example.test" },
		]);
		expect(profileLinks(view, undefined, messages.website).map((item) => item.key)).toEqual(["pr1", "pr2", "website"]);
		expect(contactOf(view)?.kind).toBe("contact");
	});

	it("closes the works with a site people show work on, else the website, else the first link", () => {
		const linkedIn = link("a", "LinkedIn", "https://linkedin.example.test/in/citra");
		const behance = link("b", "Behance", "https://www.behance.net/citra");
		const website = link("website", "", "https://citra.example.test");
		expect(moreLink([linkedIn, website, behance])).toBe(behance);
		expect(moreLink([linkedIn, website])).toBe(website);
		expect(moreLink([link("c", "Mastodon", null), linkedIn])).toBe(linkedIn);
		expect(moreLink([link("c", "Dribbble", null)])).toBeUndefined();
		expect(displayUrl("https://www.behance.net/citra/")).toBe("behance.net/citra");
	});
});

describe("Mozaik's sections", () => {
	const sections = ["about", "work", "profiles", "contact", "services"].map(section);

	it("keeps About, Profiles and a location-only Contact in the intro, and links only to what's drawn", () => {
		expect(sectionsBelowIntro(sections, false).map((item) => item.kind)).toEqual(["work", "services"]);
		expect(sectionsBelowIntro(sections, true).map((item) => item.kind)).toEqual(["work", "contact", "services"]);
		const kinds = (options: Parameters<typeof navigationSections>[1]) =>
			navigationSections(sections, options).map((item) => item.kind);
		expect(kinds({ contactBody: false, locationIsContact: false, links: 0 })).toEqual(["about", "work", "services"]);
		expect(kinds({ contactBody: false, locationIsContact: true, links: 2 })).toEqual([
			"about",
			"work",
			"profiles",
			"contact",
			"services",
		]);
	});

	it("pairs testimonials with clients, gathers CV sections into one block and short lists at its end", () => {
		const blocks = blocksOf(
			[
				"work",
				"testimonials",
				"clients",
				"testimonials",
				"experience",
				"languages",
				"skills",
				"awards",
				"custom",
				"education",
			].map(section),
		);
		expect(
			blocks.map((block) =>
				block.type === "single"
					? block.section.kind
					: block.type === "pair"
						? block.sections.map((item) => item.kind)
						: { tiles: block.tiles.map((item) => item.kind), extras: block.extras.map((item) => item.kind) },
			),
		).toEqual([
			"work",
			["testimonials", "clients"],
			["testimonials"],
			{ tiles: ["experience", "skills"], extras: ["languages", "awards"] },
			"custom",
			{ tiles: ["education"], extras: [] },
		]);
		// Two of a kind don't pair.
		expect(blocksOf(["clients", "clients"].map(section)).map((block) => block.type)).toEqual(["pair", "pair"]);
	});
});
