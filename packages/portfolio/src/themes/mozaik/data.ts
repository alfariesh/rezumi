/**
 * What Mozaik decides from the view before drawing, apart from the markup so it can be tested on its own: what the
 * intro bento holds (the location card, the profile links), where the works' closing tile leads, and how the sections
 * below the intro gather into blocks.
 */
import type { PortfolioView, PortfolioViewLocation, PortfolioViewSection } from "../../view";
import { hostOf } from "../../shared/primitives";
import { EXTRA_KINDS } from "../../shared/sections";

type Section = PortfolioViewSection;
export type ContactSection = Extract<Section, { kind: "contact" }>;
export type ProfilesSection = Extract<Section, { kind: "profiles" }>;

/** Sections Mozaik lays out as tiles of one block: CV lists beside each other, short lists in one wide tile. */
const CV_KINDS: ReadonlySet<string> = new Set(["experience", "education", "skills", "volunteer", ...EXTRA_KINDS]);
/** Sections that share a row: testimonials beside clients. */
const PAIR_KINDS: ReadonlySet<string> = new Set(["testimonials", "clients"]);
/** Sites people show work on, preferred for the works' closing "More on …" tile. */
const SHOWCASE =
	/behance|dribbble|github|gitlab|artstation|deviantart|codepen|figma|youtube|vimeo|instagram|tiktok|medium|substack|kaggle|huggingface|flickr|500px|unsplash|pinterest|cara\.app|read\.cv/i;

/** The contact section, when the page shows it. */
export function contactOf(view: PortfolioView): ContactSection | undefined {
	return view.sections.find((section): section is ContactSection => section.kind === "contact");
}

/** Whether the contact section has anything left once its location card moves into the intro (the form counts). */
export function hasContactBody(section: ContactSection | undefined): boolean {
	if (!section) return false;
	const { contact } = section;
	return Boolean(
		contact.note ||
		contact.email ||
		contact.whatsapp ||
		contact.phone ||
		contact.website ||
		contact.form ||
		contact.profiles.some((profile) => profile.href),
	);
}

/**
 * The location card the intro shows as a tile: the contact section's, when it says more than the place's name (a map,
 * work modes, relocation or local time). A name alone reads better as the intro's location chip, unless the location is
 * all the contact section has: then the tile holds `#contact`, so the buttons that lead there still land somewhere.
 */
export function locationTileOf(section: ContactSection | undefined): PortfolioViewLocation | null {
	const location = section?.contact.location;
	if (!location) return null;
	const telling = location.map || location.workModes.length || location.relocate || location.showLocalTime;
	return telling || !hasContactBody(section) ? location : null;
}

export type ProfileLink = { key: string; label: string; network: string; href: string | null };

/**
 * The person's profile links for the intro's links tile and the works' "More on …" tile: the profiles (from the
 * contact section, and from the Profiles section when it is shown) and the website, without repeats.
 */
export function profileLinks(
	view: PortfolioView,
	profiles: ProfilesSection | undefined,
	websiteLabel: string,
): ProfileLink[] {
	const links: ProfileLink[] = [];
	const seen = new Set<string>();
	const add = (link: ProfileLink) => {
		const key = link.href ?? `${link.network}:${link.label}`;
		if (seen.has(key) || !link.label) return;
		seen.add(key);
		links.push(link);
	};
	const contact = contactOf(view)?.contact;
	for (const profile of contact?.profiles ?? [])
		add({
			key: profile.id,
			label: profile.network || profile.username || (profile.href ? hostOf(profile.href) : ""),
			network: profile.network,
			href: profile.href,
		});
	for (const item of profiles?.items ?? []) {
		const href = item.website.url.trim() || null;
		const network = item.network.trim();
		add({
			key: item.id,
			label: network || item.username.trim() || (href ? hostOf(href) : ""),
			network,
			href,
		});
	}
	if (contact?.website) add({ key: "website", label: websiteLabel, network: "", href: contact.website.href });
	return links;
}

/** Where the works' closing "More on …" tile leads: a site people show work on, else the website, else the first link. */
export function moreLink(links: readonly ProfileLink[]): ProfileLink | undefined {
	const linked = links.filter((link) => link.href);
	return (
		linked.find((link) => SHOWCASE.test(`${link.network} ${link.href}`)) ??
		linked.find((link) => link.key === "website") ??
		linked[0]
	);
}

/** A link as people read it: `behance.net/citra`. */
export const displayUrl = (href: string) => href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

/** The sections below the intro: About and the profiles live in the bento, and so does a contact with only a location. */
export function sectionsBelowIntro(sections: readonly Section[], contactBody: boolean): Section[] {
	return sections.filter(
		(section) =>
			section.kind !== "about" && section.kind !== "profiles" && !(section.kind === "contact" && !contactBody),
	);
}

type NavigationOptions = { contactBody: boolean; locationIsContact: boolean; links: number };

/** The sections the navigation may link to: Contact and Profiles only where the page draws them. */
export function navigationSections(sections: readonly Section[], options: NavigationOptions): Section[] {
	return sections.filter(
		(section) =>
			(section.kind !== "contact" || options.contactBody || options.locationIsContact) &&
			(section.kind !== "profiles" || options.links > 0),
	);
}

type Block =
	| { type: "single"; section: Section }
	| { type: "pair"; sections: Section[] }
	| { type: "cv"; tiles: Section[]; extras: Section[] };

/**
 * The sections below the intro as Mozaik's blocks: testimonials beside clients, CV sections as one bento of tiles
 * (short lists gathered in one wide tile at its end), everything else on its own.
 */
export function blocksOf(sections: readonly Section[]): Block[] {
	const blocks: Block[] = [];
	for (const section of sections) {
		const last = blocks.at(-1);
		if (PAIR_KINDS.has(section.kind)) {
			if (last?.type === "pair" && last.sections.length === 1 && last.sections[0]?.kind !== section.kind)
				last.sections.push(section);
			else blocks.push({ type: "pair", sections: [section] });
		} else if (CV_KINDS.has(section.kind)) {
			const block: Extract<Block, { type: "cv" }> = last?.type === "cv" ? last : { type: "cv", tiles: [], extras: [] };
			if (block !== last) blocks.push(block);
			(EXTRA_KINDS.has(section.kind) ? block.extras : block.tiles).push(section);
		} else blocks.push({ type: "single", section });
	}
	return blocks;
}
